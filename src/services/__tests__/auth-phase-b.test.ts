import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  register,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  resendVerification,
} from "../auth.service";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/services/email.service";
import { AppError } from "@/lib/errors";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  refreshToken: {
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const mockSendEmail = sendTransactionalEmail as ReturnType<typeof vi.fn>;

describe("auth.service — Phase B", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── B.1: Password Reset ──────────────────────────────

  describe("requestPasswordReset", () => {
    it("should send reset email for existing user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
      });
      mockPrisma.user.update.mockResolvedValue({});

      await requestPasswordReset("test@example.com");

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        }),
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        "test@example.com",
        expect.stringContaining("Reset your password"),
        expect.stringContaining("reset-password/"),
      );
    });

    it("should silently succeed for nonexistent email (no leak)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should throw VALIDATION_ERROR for empty email", async () => {
      await expect(requestPasswordReset("")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("should set reset token expiry to 1 hour from now", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
      });
      mockPrisma.user.update.mockResolvedValue({});

      const before = Date.now();
      await requestPasswordReset("test@example.com");
      const after = Date.now();

      const call = mockPrisma.user.update.mock.calls[0][0];
      const expires = call.data.passwordResetExpires.getTime();
      const oneHourMs = 60 * 60 * 1000;

      expect(expires).toBeGreaterThanOrEqual(before + oneHourMs);
      expect(expires).toBeLessThanOrEqual(after + oneHourMs);
    });
  });

  describe("resetPassword", () => {
    it("should reset password and revoke all refresh tokens", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 3600000),
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await resetPassword(rawToken, "newpassword123");

      // Password was updated and reset fields cleared
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: "user-1" });
      expect(updateCall.data.passwordResetToken).toBeNull();
      expect(updateCall.data.passwordResetExpires).toBeNull();
      expect(updateCall.data.passwordHash).toBeTruthy();

      // Verify the new password hash is valid
      const isValid = await bcrypt.compare("newpassword123", updateCall.data.passwordHash);
      expect(isValid).toBe(true);

      // All refresh tokens revoked
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should throw UNAUTHORIZED for invalid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(resetPassword("invalid-token", "newpassword123")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid or expired reset token",
      });
    });

    it("should throw VALIDATION_ERROR for short password", async () => {
      await expect(resetPassword("some-token", "short")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Password must be at least 8 characters",
      });
    });

    it("should throw VALIDATION_ERROR for missing params", async () => {
      await expect(resetPassword("", "password123")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
      await expect(resetPassword("token", "")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  // ── B.2: Email Verification ──────────────────────────

  describe("sendVerificationEmail", () => {
    it("should generate token and send email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        emailVerified: false,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await sendVerificationEmail("user-1");

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({
            emailVerificationToken: expect.any(String),
            emailVerificationExpires: expect.any(Date),
          }),
        }),
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        "test@example.com",
        expect.stringContaining("Verify your email"),
        expect.stringContaining("verify-email/"),
      );
    });

    it("should skip sending if already verified", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        emailVerified: true,
      });

      await sendVerificationEmail("user-1");

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should throw NOT_FOUND for nonexistent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(sendVerificationEmail("nonexistent")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("verifyEmail", () => {
    it("should verify email and clear token fields", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() + 86400000),
      });
      mockPrisma.user.update.mockResolvedValue({});

      await verifyEmail(rawToken);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });
    });

    it("should throw UNAUTHORIZED for invalid token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(verifyEmail("invalid-token")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid or expired verification token",
      });
    });

    it("should throw VALIDATION_ERROR for empty token", async () => {
      await expect(verifyEmail("")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("resendVerification", () => {
    it("should send verification email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "resend-user-1",
        email: "resend@example.com",
        emailVerified: false,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await resendVerification("resend-user-1");

      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("should rate-limit after 3 requests in 1 hour", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "rate-limit-user",
        email: "ratelimit@example.com",
        emailVerified: false,
      });
      mockPrisma.user.update.mockResolvedValue({});

      // First 3 should succeed
      await resendVerification("rate-limit-user");
      await resendVerification("rate-limit-user");
      await resendVerification("rate-limit-user");

      // 4th should fail
      await expect(resendVerification("rate-limit-user")).rejects.toMatchObject({
        code: "RATE_LIMITED",
      });
    });
  });

  // ── Registration auto-sends verification ─────────────

  describe("register — auto verification email", () => {
    it("should auto-send verification email on registration", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "new-user-1",
        email: "new@example.com",
        name: "New User",
        role: "USER",
        emailVerified: false,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

      // Mock for the sendVerificationEmail call inside register
      // The first findUnique is for duplicate check (returns null),
      // so we need the second findUnique call (from sendVerificationEmail) to return the user
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce({
          // sendVerificationEmail lookup
          id: "new-user-1",
          email: "new@example.com",
          emailVerified: false,
        });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await register("new@example.com", "password123", "New User");

      expect(result.user.emailVerified).toBe(false);
      expect(result.user.email).toBe("new@example.com");

      // Give the fire-and-forget promise time to resolve
      await new Promise((r) => setTimeout(r, 50));

      // Verification email should have been sent
      expect(mockSendEmail).toHaveBeenCalledWith(
        "new@example.com",
        expect.stringContaining("Verify your email"),
        expect.any(String),
      );
    });
  });
});
