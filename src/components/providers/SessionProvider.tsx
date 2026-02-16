"use client";

import { AuthProvider } from "./AuthProvider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
