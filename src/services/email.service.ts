import { prisma } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/client";

/**
 * Email provider adapter interface.
 * Implementations can wrap Resend, Postmark, SES, etc.
 */
interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

/**
 * Console email provider — logs emails to stdout.
 * Used when no real provider is configured.
 */
class ConsoleEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[email] To: ${to} | Subject: ${subject}`);
    console.log(`[email] Body: ${body}`);
  }
}

/**
 * Resend email provider.
 */
class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to,
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[email] Resend API error: ${error}`);
    }
  }
}

/**
 * Get the configured email provider based on environment variables.
 */
function getEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) {
    return new ResendEmailProvider(
      process.env.RESEND_API_KEY,
      process.env.EMAIL_FROM || "Cardboard <noreply@cardboard.app>",
    );
  }

  return new ConsoleEmailProvider();
}

const provider = getEmailProvider();

/**
 * Send a transactional email directly (e.g., password reset, email verification).
 * Bypasses notification preference checks.
 */
export async function sendTransactionalEmail(
  to: string,
  subject: string,
  body: string,
): Promise<boolean> {
  try {
    await provider.sendEmail(to, subject, body);
    return true;
  } catch (error) {
    console.error(`[email] Failed to send transactional email to ${to}:`, error);
    return false;
  }
}

/**
 * Map notification types to UserSettings preference fields.
 */
const NOTIFICATION_PREFERENCE_MAP: Partial<
  Record<NotificationType, keyof UserSettingsPreferences>
> = {
  TRADE_FILLED: "notifyTradeFilled",
  ORDER_PARTIALLY_FILLED: "notifyOrderUpdates",
  ORDER_CANCELLED: "notifyOrderUpdates",
  CARD_VERIFIED: "notifyCardVerified",
  CARD_VERIFICATION_FAILED: "notifyCardVerified",
  ESCROW_RELEASED: "notifyEscrowReleased",
  SHIPMENT_UPDATE: "notifyShipmentUpdate",
  DISPUTE_OPENED: "notifyDisputeUpdate",
  DISPUTE_RESOLVED: "notifyDisputeUpdate",
};

interface UserSettingsPreferences {
  emailNotifications: boolean;
  notifyTradeFilled: boolean;
  notifyOrderUpdates: boolean;
  notifyCardVerified: boolean;
  notifyEscrowReleased: boolean;
  notifyShipmentUpdate: boolean;
  notifyDisputeUpdate: boolean;
}

/**
 * Send a transactional email for a notification event.
 * Checks user settings before sending.
 */
export async function sendNotificationEmail(
  userId: string,
  type: NotificationType,
  subject: string,
  body: string,
): Promise<boolean> {
  try {
    // Get user with settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        settings: {
          select: {
            emailNotifications: true,
            notifyTradeFilled: true,
            notifyOrderUpdates: true,
            notifyCardVerified: true,
            notifyEscrowReleased: true,
            notifyShipmentUpdate: true,
            notifyDisputeUpdate: true,
          },
        },
      },
    });

    if (!user) return false;

    // Check master email toggle (default true if no settings exist)
    const settings = user.settings;
    if (settings && !settings.emailNotifications) return false;

    // Check per-type preference
    const prefKey = NOTIFICATION_PREFERENCE_MAP[type];
    if (prefKey && settings && !settings[prefKey]) return false;

    await provider.sendEmail(user.email, subject, body);
    return true;
  } catch (error) {
    console.error(`[email] Failed to send email to user ${userId}:`, error);
    return false;
  }
}
