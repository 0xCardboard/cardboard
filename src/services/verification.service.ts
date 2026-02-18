import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { releaseEscrow, cancelEscrow } from "@/services/escrow.service";
import { createNotification } from "@/services/notification.service";
import { getPsaScanUrl, getPsaScanImageUrls } from "@/services/psa-scan.service";
import type { CardInstanceStatus } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────

interface VerificationFilters {
  page?: number;
  limit?: number;
  filter?: "unclaimed" | "my_claims" | "all";
  adminId?: string;
  certNumber?: string;
}

export interface CertLookupResult {
  valid: boolean;
  certNumber: string;
  grade?: number;
  cardName?: string;
  year?: string;
  details?: string;
}

interface CompleteVerificationInput {
  approved: boolean;
  notes?: string;
  rejectReason?: string;
}

// ─── Queue ──────────────────────────────────────────────

/**
 * Get the verification queue — card instances awaiting verification.
 * Supports filtering by claim status and cert number search.
 */
export async function getVerificationQueue(filters: VerificationFilters = {}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    status: "PENDING_VERIFICATION" as CardInstanceStatus,
  };

  // Filter by claim status
  if (filters.filter === "unclaimed") {
    where.claimedById = null;
  } else if (filters.filter === "my_claims" && filters.adminId) {
    where.claimedById = filters.adminId;
  }
  // "all" — no claim filter

  // Search by cert number
  if (filters.certNumber) {
    where.certNumber = { contains: filters.certNumber };
  }

  const [data, total] = await prisma.$transaction([
    prisma.cardInstance.findMany({
      where,
      include: {
        card: {
          select: {
            id: true,
            name: true,
            number: true,
            imageUrl: true,
            imageUrlHiRes: true,
            set: { select: { id: true, name: true, game: { select: { id: true, name: true } } } },
          },
        },
        owner: { select: { id: true, name: true, email: true } },
        claimedBy: { select: { id: true, name: true } },
        orders: {
          where: { side: "SELL", status: { in: ["FILLED", "PARTIALLY_FILLED"] } },
          select: {
            sellTrades: {
              select: { id: true, buyerId: true, price: true, escrowStatus: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { updatedAt: "asc" }, // Oldest first (FIFO)
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

// ─── Claiming ───────────────────────────────────────────

/**
 * Claim a card instance for verification — locks it to this admin.
 */
export async function claimCard(adminId: string, cardInstanceId: string) {
  const instance = await prisma.cardInstance.findUnique({
    where: { id: cardInstanceId },
  });

  if (!instance) throw new AppError("NOT_FOUND", "Card instance not found");
  if (instance.status !== "PENDING_VERIFICATION") {
    throw new AppError("VALIDATION_ERROR", `Card status is ${instance.status}, expected PENDING_VERIFICATION`);
  }
  if (instance.claimedById && instance.claimedById !== adminId) {
    throw new AppError("CONFLICT", "Card is already claimed by another admin");
  }

  return prisma.cardInstance.update({
    where: { id: cardInstanceId },
    data: { claimedById: adminId, claimedAt: new Date() },
    include: {
      card: {
        select: {
          id: true,
          name: true,
          number: true,
          imageUrl: true,
          imageUrlHiRes: true,
          set: { select: { id: true, name: true, game: { select: { id: true, name: true } } } },
        },
      },
      owner: { select: { id: true, name: true, email: true } },
      claimedBy: { select: { id: true, name: true } },
      orders: {
        where: { side: "SELL", status: { in: ["FILLED", "PARTIALLY_FILLED"] } },
        select: {
          sellTrades: {
            select: { id: true, buyerId: true, price: true, escrowStatus: true },
          },
        },
        take: 1,
      },
    },
  });
}

/**
 * Release a claim — admin decides to skip or can't verify.
 */
export async function unclaimCard(adminId: string, cardInstanceId: string) {
  const instance = await prisma.cardInstance.findUnique({
    where: { id: cardInstanceId },
  });

  if (!instance) throw new AppError("NOT_FOUND", "Card instance not found");
  if (instance.claimedById !== adminId) {
    throw new AppError("FORBIDDEN", "You can only unclaim cards you have claimed");
  }

  return prisma.cardInstance.update({
    where: { id: cardInstanceId },
    data: { claimedById: null, claimedAt: null },
  });
}

/**
 * Get cards this admin has claimed but not yet resolved.
 */
export async function getMyClaimedCards(adminId: string) {
  return prisma.cardInstance.findMany({
    where: {
      claimedById: adminId,
      status: "PENDING_VERIFICATION" as CardInstanceStatus,
    },
    include: {
      card: {
        select: {
          id: true,
          name: true,
          number: true,
          imageUrl: true,
          set: { select: { id: true, name: true, game: { select: { id: true, name: true } } } },
        },
      },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { claimedAt: "asc" },
  });
}

// ─── Verification ───────────────────────────────────────

/**
 * Complete verification — approve or reject a claimed card.
 * Replaces the old verifyCard() function with a richer workflow.
 */
export async function completeVerification(
  adminId: string,
  cardInstanceId: string,
  input: CompleteVerificationInput,
): Promise<void> {
  const instance = await prisma.cardInstance.findUnique({
    where: { id: cardInstanceId },
    include: {
      card: { select: { name: true } },
      orders: {
        where: { side: "SELL", status: { in: ["FILLED", "PARTIALLY_FILLED"] } },
        include: {
          sellTrades: {
            where: { escrowStatus: "CAPTURED" },
            select: { id: true, buyerId: true, sellerId: true, price: true },
          },
        },
      },
    },
  });

  if (!instance) throw new AppError("NOT_FOUND", "Card instance not found");
  if (instance.status !== "PENDING_VERIFICATION") {
    throw new AppError("VALIDATION_ERROR", `Card status is ${instance.status}, expected PENDING_VERIFICATION`);
  }
  if (instance.claimedById !== adminId) {
    throw new AppError("FORBIDDEN", "You must claim this card before verifying it");
  }

  const hasPendingTrade = instance.orders.some((o) => o.sellTrades.length > 0);
  const notes = input.notes ?? input.rejectReason;

  if (input.approved) {
    // Fetch PSA scan images
    let psaScanUrl: string | undefined;
    let imageUrls: string[] = [];
    if (instance.gradingCompany === "PSA") {
      psaScanUrl = getPsaScanUrl(instance.certNumber);
      const scanImages = await getPsaScanImageUrls(instance.certNumber);
      imageUrls = [scanImages.front, scanImages.back].filter((u): u is string => !!u);
    }

    // Determine the buyer if there's a pending trade
    const pendingTrade = instance.orders
      .flatMap((o) => o.sellTrades)
      .find((t) => t.buyerId);

    // Mark as verified and transfer ownership to buyer if trade exists
    await prisma.cardInstance.update({
      where: { id: cardInstanceId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedById: adminId,
        verificationNotes: notes,
        psaScanUrl,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        // Transfer ownership to buyer when there's a pending trade
        ...(pendingTrade ? { ownerId: pendingTrade.buyerId } : {}),
        // Clear claiming fields
        claimedById: null,
        claimedAt: null,
      },
    });

    // Release escrow for all associated trades (sell-first flow)
    for (const order of instance.orders) {
      for (const trade of order.sellTrades) {
        await releaseEscrow(trade.id);
      }
    }

    if (hasPendingTrade && pendingTrade) {
      // Notify seller — funds released
      await createNotification(
        instance.ownerId,
        "CARD_VERIFIED",
        "Card Verified — Sale Complete",
        `Your ${instance.card.name} (cert: ${instance.certNumber}) has been verified! Funds are being released to your account.` +
          (notes ? ` Note: ${notes}` : ""),
        { cardInstanceId },
      );

      // Notify buyer — card added to their portfolio
      await createNotification(
        pendingTrade.buyerId,
        "CARD_VERIFIED",
        "Card Verified — Purchase Complete",
        `The ${instance.card.name} (cert: ${instance.certNumber}) you purchased has been verified and added to your portfolio.`,
        { cardInstanceId },
      );
    } else {
      // No trade — just a vault deposit, notify owner
      await createNotification(
        instance.ownerId,
        "CARD_VERIFIED",
        "Card Verified",
        `Your ${instance.card.name} (cert: ${instance.certNumber}) has been verified and added to your portfolio.` +
          (notes ? ` Note: ${notes}` : ""),
        { cardInstanceId },
      );
    }
  } else {
    // Rejection
    const rejectReason = input.rejectReason ?? notes ?? "Verification failed";

    await prisma.cardInstance.update({
      where: { id: cardInstanceId },
      data: {
        status: "PENDING_SHIPMENT", // Queue for return to seller
        verificationNotes: rejectReason,
        // Clear claiming fields
        claimedById: null,
        claimedAt: null,
      },
    });

    // Refund buyers for all associated trades (sell-first flow)
    for (const order of instance.orders) {
      for (const trade of order.sellTrades) {
        await cancelEscrow(trade.id, rejectReason);
      }
    }

    // Notify owner
    await createNotification(
      instance.ownerId,
      "CARD_VERIFICATION_FAILED",
      "Verification Failed",
      `Your ${instance.card.name} (cert: ${instance.certNumber}) failed verification. Reason: ${rejectReason}. The card will be returned to you.`,
      { cardInstanceId, reason: rejectReason },
    );
  }
}

/**
 * Legacy wrapper — keeps existing API route working during transition.
 */
export async function verifyCard(
  adminId: string,
  cardInstanceId: string,
  passed: boolean,
  notes?: string,
): Promise<void> {
  // If not claimed, auto-claim first (backward compat)
  const instance = await prisma.cardInstance.findUnique({
    where: { id: cardInstanceId },
    select: { claimedById: true },
  });
  if (instance && !instance.claimedById) {
    await claimCard(adminId, cardInstanceId);
  }

  return completeVerification(adminId, cardInstanceId, {
    approved: passed,
    notes,
  });
}

// ─── Cert Lookup ────────────────────────────────────────

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
 * Run cert lookup AND fetch PSA scan URL in one call.
 * Caches the cert lookup result on the CardInstance.
 */
export async function getCertLookupAndScan(
  cardInstanceId: string,
  certNumber: string,
  gradingCompany: string,
) {
  const certResult = await lookupCertification(gradingCompany, certNumber);
  const psaScanUrl = gradingCompany === "PSA" ? getPsaScanUrl(certNumber) : null;

  // Cache the lookup data on the card instance
  await prisma.cardInstance.update({
    where: { id: cardInstanceId },
    data: {
      certLookupData: JSON.parse(JSON.stringify(certResult)),
      psaScanUrl,
    },
  });

  return { certResult, psaScanUrl };
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
