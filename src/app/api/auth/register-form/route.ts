import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return NextResponse.redirect(
      new URL("/register?error=Email+and+password+are+required", request.url)
    );
  }

  if (password.length < 8) {
    return NextResponse.redirect(
      new URL("/register?error=Password+must+be+at+least+8+characters", request.url)
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.redirect(
      new URL("/register?error=An+account+with+this+email+already+exists", request.url)
    );
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

  // Create session token
  const token = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "USER",
      sub: user.id,
    },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  // Set session cookie and redirect
  const cookieStore = await cookies();
  cookieStore.set("next-auth.session-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(new URL("/cards", request.url));
}
