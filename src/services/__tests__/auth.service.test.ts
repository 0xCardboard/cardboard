import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { register, login, refreshAccessToken, revokeToken, verifyAccessToken } from "../auth.service";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

// Type helpers for mocked prisma
const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  refreshToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("should create a new user and return tokens", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        role: "USER",
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

      const result = await register("test@example.com", "password123", "Test");

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.name).toBe("Test");
      expect(result.user.role).toBe("USER");
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it("should throw VALIDATION_ERROR for missing email", async () => {
      await expect(register("", "password123")).rejects.toThrow(AppError);
      await expect(register("", "password123")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("should throw VALIDATION_ERROR for short password", async () => {
      await expect(register("test@example.com", "short")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Password must be at least 8 characters",
      });
    });

    it("should throw CONFLICT for duplicate email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(register("existing@example.com", "password123")).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  describe("login", () => {
    it("should return user and tokens for valid credentials", async () => {
      const hash = await bcrypt.hash("password123", 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        role: "USER",
        passwordHash: hash,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

      const result = await login("test@example.com", "password123");

      expect(result.user.email).toBe("test@example.com");
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it("should throw UNAUTHORIZED for wrong password", async () => {
      const hash = await bcrypt.hash("correctpassword", 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        passwordHash: hash,
      });

      await expect(login("test@example.com", "wrongpassword")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should throw UNAUTHORIZED for nonexistent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(login("nobody@example.com", "password123")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should throw VALIDATION_ERROR for missing credentials", async () => {
      await expect(login("", "password123")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("refreshAccessToken", () => {
    it("should return new token pair for valid refresh token", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        token: "valid-token",
        family: "family-1",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: { role: "USER" },
      });
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({ id: "rt-2" });

      const result = await refreshAccessToken("valid-token");

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rt-1" },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it("should revoke entire family on token reuse", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        token: "reused-token",
        family: "family-1",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // Already revoked = token reuse
        user: { role: "USER" },
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(refreshAccessToken("reused-token")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "Token reuse detected, all sessions revoked",
      });

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: "family-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should throw UNAUTHORIZED for expired token", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        token: "expired-token",
        family: "family-1",
        expiresAt: new Date(Date.now() - 86400000), // Expired
        revokedAt: null,
        user: { role: "USER" },
      });

      await expect(refreshAccessToken("expired-token")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should throw UNAUTHORIZED for nonexistent token", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(refreshAccessToken("nonexistent")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("revokeToken", () => {
    it("should revoke the token family", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        family: "family-1",
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await revokeToken("some-token");

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: "family-1" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should silently handle nonexistent token", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(revokeToken("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("verifyAccessToken", () => {
    it("should return payload for valid token", () => {
      const token = jwt.sign({ sub: "user-1", role: "USER" }, process.env.JWT_SECRET!);

      const payload = verifyAccessToken(token);

      expect(payload.sub).toBe("user-1");
      expect(payload.role).toBe("USER");
    });

    it("should throw UNAUTHORIZED for expired token", () => {
      const token = jwt.sign({ sub: "user-1", role: "USER" }, process.env.JWT_SECRET!, {
        expiresIn: "-1s",
      });

      expect(() => verifyAccessToken(token)).toThrow(AppError);
      expect(() => verifyAccessToken(token)).toThrow("Access token expired");
    });

    it("should throw UNAUTHORIZED for invalid token", () => {
      expect(() => verifyAccessToken("garbage")).toThrow(AppError);
      expect(() => verifyAccessToken("garbage")).toThrow("Invalid access token");
    });

    it("should throw UNAUTHORIZED for token signed with wrong secret", () => {
      const token = jwt.sign({ sub: "user-1", role: "USER" }, "wrong-secret");

      expect(() => verifyAccessToken(token)).toThrow(AppError);
    });
  });
});
