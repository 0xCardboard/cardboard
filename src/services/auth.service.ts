import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { sendTransactionalEmail } from "@/services/email.service";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_VERIFICATION_LIMIT = 3;
const RESEND_VERIFICATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenPayload {
  sub: string;
  role: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified?: boolean;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}

function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role } satisfies AccessTokenPayload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

async function createRefreshToken(userId: string, family?: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenFamily = family ?? crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      family: tokenFamily,
      expiresAt,
    },
  });

  return token;
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<{ user: UserInfo; tokens: TokenPair }> {
  if (!email || !password) {
    throw new AppError("VALIDATION_ERROR", "Email and password are required");
  }

  if (password.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 8 characters");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError("CONFLICT", "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
      reputation: { create: {} },
    },
  });

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id);

  // Auto-send verification email (fire-and-forget; don't block registration)
  sendVerificationEmail(user.id).catch((err) =>
    console.error("[auth] Failed to send verification email on register:", err),
  );

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false },
    tokens: { accessToken, refreshToken },
  };
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: UserInfo; tokens: TokenPair }> {
  if (!email || !password) {
    throw new AppError("VALIDATION_ERROR", "Email and password are required");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password");
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
    tokens: { accessToken, refreshToken },
  };
}

export async function refreshAccessToken(token: string): Promise<TokenPair> {
  if (!token) {
    throw new AppError("VALIDATION_ERROR", "Refresh token is required");
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!storedToken) {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token");
  }

  // Token was revoked — possible token theft. Revoke entire family.
  if (storedToken.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: storedToken.family },
      data: { revokedAt: new Date() },
    });
    throw new AppError("UNAUTHORIZED", "Token reuse detected, all sessions revoked");
  }

  if (storedToken.expiresAt < new Date()) {
    throw new AppError("UNAUTHORIZED", "Refresh token expired");
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Issue new pair in the same family
  const accessToken = signAccessToken(storedToken.userId, storedToken.user.role);
  const newRefreshToken = await createRefreshToken(storedToken.userId, storedToken.family);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function revokeToken(token: string): Promise<void> {
  if (!token) return;

  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
  if (!storedToken) return;

  // Revoke entire family (logs out all sessions in this chain)
  await prisma.refreshToken.updateMany({
    where: { family: storedToken.family },
    data: { revokedAt: new Date() },
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
    if (!payload.sub || !payload.role) {
      throw new AppError("UNAUTHORIZED", "Invalid token payload");
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("UNAUTHORIZED", "Access token expired");
    }
    throw new AppError("UNAUTHORIZED", "Invalid access token");
  }
}

export async function getUserById(userId: string): Promise<UserInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, emailVerified: true },
  });
  return user;
}

// ── Helper: generate raw token + SHA-256 hash ──────────────

function generateTokenPair(): { raw: string; hashed: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

// ── B.1: Password Reset ────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) {
    throw new AppError("VALIDATION_ERROR", "Email is required");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always succeed to avoid leaking whether email exists
  if (!user) return;

  const { raw, hashed } = generateTokenPair();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashed,
      passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
    },
  });

  const resetUrl = `${getAppUrl()}/reset-password/${raw}`;
  await sendTransactionalEmail(
    user.email,
    "Reset your password — Cardboard",
    `You requested a password reset. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) {
    throw new AppError("VALIDATION_ERROR", "Token and new password are required");
  }

  if (newPassword.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 8 characters");
  }

  const hashed = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashed,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  // Invalidate ALL refresh tokens (force re-login on all devices)
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ── B.2: Email Verification ────────────────────────────────

export async function sendVerificationEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  });

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  if (user.emailVerified) return;

  const { raw, hashed } = generateTokenPair();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashed,
      emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS),
    },
  });

  const verifyUrl = `${getAppUrl()}/verify-email/${raw}`;
  await sendTransactionalEmail(
    user.email,
    "Verify your email — Cardboard",
    `Welcome to Cardboard! Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  );
}

export async function verifyEmail(token: string): Promise<void> {
  if (!token) {
    throw new AppError("VALIDATION_ERROR", "Verification token is required");
  }

  const hashed = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashed,
      emailVerificationExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired verification token");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });
}

// In-memory rate limit store for verification resends.
// In production this would use Redis, but for MVP this is sufficient.
const verificationResendTimestamps = new Map<string, number[]>();

export async function resendVerification(userId: string): Promise<void> {
  // Rate limit: max 3 per hour
  const now = Date.now();
  const timestamps = verificationResendTimestamps.get(userId) ?? [];
  const recentTimestamps = timestamps.filter(
    (t) => now - t < RESEND_VERIFICATION_WINDOW_MS,
  );

  if (recentTimestamps.length >= RESEND_VERIFICATION_LIMIT) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many verification emails. Try again later.",
    );
  }

  await sendVerificationEmail(userId);

  recentTimestamps.push(now);
  verificationResendTimestamps.set(userId, recentTimestamps);
}
