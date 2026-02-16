"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { error: "Invalid email or password" };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return { error: "Invalid email or password" };
  }

  // Create session token and set cookie
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

  const cookieStore = await cookies();
  cookieStore.set("next-auth.session-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  redirect("/cards");
}
