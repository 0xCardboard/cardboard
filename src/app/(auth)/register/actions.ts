"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export type RegisterState = {
  error?: string;
};

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "An account with this email already exists" };
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

  // Create session token and set cookie (auto sign-in)
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

  const cookieStore = await cookies();
  cookieStore.set("next-auth.session-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  redirect("/cards");
}
