import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

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

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
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
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
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
    select: { id: true, email: true, name: true, role: true },
  });
  return user;
}
