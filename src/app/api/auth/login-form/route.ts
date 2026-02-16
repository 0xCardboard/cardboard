import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return NextResponse.redirect(
      new URL("/login?error=Email+and+password+are+required", request.url)
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?error=Invalid+email+or+password", request.url)
    );
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return NextResponse.redirect(
      new URL("/login?error=Invalid+email+or+password", request.url)
    );
  }

  // Create session token
  const token = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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
