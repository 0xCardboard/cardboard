import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { releaseEscrow, cancelEscrow } from "@/services/escrow.service";
import { createNotification } from "@/services/notification.service";
import type { CardInstanceStatus } from "@/generated/prisma/client";

interface VerificationFilters {
  page?: number;
  limit?: number;
}

interface CertLookupResult {
  valid: boolean;
  certNumber: string;
  grade?: number;
  cardName?: string;
  year?: string;
  details?: string;
}

/**
 * Get the verification queue — card instances awaiting verification.
 */
export async function getVerificationQueue(filters: VerificationFilters = {}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where = { status: "PENDING_VERIFICATION" as CardInstanceStatus };

  const [data, total] = await prisma.$transaction([
    prisma.cardInstance.findMany({
      where,
      include: {
        card: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            set: { select: { id: true, name: true, game: { select: { id: true, name: true } } } },
          },
        },
        owner: { select: { id: true, name: true, email: true } },
        orders: {
          where: { side: "SELL", status: { in: ["FILLED", "PARTIALLY_FILLED"] } },
          select: {
            sellTrades: {
              select: { id: true, buyerId: true, price: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { updatedAt: "asc" }, // Oldest first
      skip,
      take: limit,
    }),
    prisma.cardInstance.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Admin verifies or rejects a card instance.
 */
export async function verifyCard(
  adminId: string,
  cardInstanceId: string,
  passed: boolean,
  notes?: string,
): Promise<void> {
  const instance = await prisma.cardInstance.findUnique({
    where: { id: cardInstanceId },
    include: {
      orders: {
        where: { side: "SELL", status: { in: ["FILLED", "PARTIALLY_FILLED"] } },
        include: {
          sellTrades: {
            where: { escrowStatus: "CAPTURED" },
            select: { id: true, buyerId: true, sellerId: true },
          },
        },
      },
    },
  });

  if (!instance) throw new AppError("NOT_FOUND", "Card instance not found");
  if (instance.status !== "PENDING_VERIFICATION") {
    throw new AppError("VALIDATION_ERROR", `Card status is ${instance.status}, expected PENDING_VERIFICATION`);
  }

  if (passed) {
    // Mark as verified
    await prisma.cardInstance.update({
      where: { id: cardInstanceId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedById: adminId,
      },
    });

    // Release escrow for all associated trades
    for (const order of instance.orders) {
      for (const trade of order.sellTrades) {
        await releaseEscrow(trade.id);
      }
    }

    // Notify owner
    await createNotification(
      instance.ownerId,
      "CARD_VERIFIED",
      "Card Verified",
      `Your card (cert: ${instance.certNumber}) has been verified.${notes ? ` Note: ${notes}` : ""}`,
      { cardInstanceId },
    );
  } else {
    // Verification failed
    await prisma.cardInstance.update({
      where: { id: cardInstanceId },
      data: { status: "PENDING_SHIPMENT" }, // Will be returned to seller
    });

    // Refund buyers for all associated trades
    for (const order of instance.orders) {
      for (const trade of order.sellTrades) {
        await cancelEscrow(trade.id, notes ?? "Card verification failed");
      }
    }

    // Notify owner
    await createNotification(
      instance.ownerId,
      "CARD_VERIFICATION_FAILED",
      "Verification Failed",
      `Your card (cert: ${instance.certNumber}) failed verification.${notes ? ` Reason: ${notes}` : ""} The card will be returned to you.`,
      { cardInstanceId },
    );
  }
}

/**
 * Look up a certification number against the grading company API.
 * Currently only PSA has a programmatic API.
 * BGS/CGC fall back to manual verification.
 */
export async function lookupCertification(
  gradingCompany: string,
  certNumber: string,
): Promise<CertLookupResult> {
  if (gradingCompany === "PSA") {
    return lookupPsaCert(certNumber);
  }

  // BGS and CGC don't have public APIs — return unknown for manual verification
  return {
    valid: false,
    certNumber,
    details: `No API available for ${gradingCompany}. Manual verification required.`,
  };
}

/**
 * PSA cert lookup via their public API.
 */
async function lookupPsaCert(certNumber: string): Promise<CertLookupResult> {
  const clientId = process.env.PSA_API_CLIENT_ID;
  const clientSecret = process.env.PSA_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      valid: false,
      certNumber,
      details: "PSA API credentials not configured. Manual verification required.",
    };
  }

  try {
    // PSA uses OAuth 2.0 — get access token
    const tokenResponse = await fetch("https://api.psacard.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      return { valid: false, certNumber, details: "Failed to authenticate with PSA API" };
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // Look up cert number
    const certResponse = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${certNumber}`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );

    if (!certResponse.ok) {
      return { valid: false, certNumber, details: "Cert number not found in PSA database" };
    }

    const certData = (await certResponse.json()) as {
      PSACert?: {
        CertNumber?: string;
        CardGrade?: string;
        Subject?: string;
        Year?: string;
      };
    };

    if (!certData.PSACert) {
      return { valid: false, certNumber, details: "Invalid response from PSA API" };
    }

    const gradeStr = certData.PSACert.CardGrade;
    const grade = gradeStr ? parseFloat(gradeStr) : undefined;

    return {
      valid: true,
      certNumber: certData.PSACert.CertNumber ?? certNumber,
      grade,
      cardName: certData.PSACert.Subject,
      year: certData.PSACert.Year,
    };
  } catch {
    return { valid: false, certNumber, details: "Error contacting PSA API" };
  }
}
