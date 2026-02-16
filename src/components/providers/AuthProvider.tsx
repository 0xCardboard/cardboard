"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}

interface AuthContextType {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "cardboard_access_token";
const REFRESH_KEY = "cardboard_refresh_token";

function getStoredTokens() {
  if (typeof window === "undefined") return { accessToken: null, refreshToken: null };
  return {
    accessToken: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function tryRefreshTokens(): Promise<{ user: User; accessToken: string } | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const { data } = await res.json();
    storeTokens(data.accessToken, data.refreshToken);

    const meRes = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });

    if (!meRes.ok) return null;

    const { data: userData } = await meRes.json();
    return { user: userData, accessToken: data.accessToken };
  } catch {
    return null;
  }
}

async function fetchCurrentUser(): Promise<User | null> {
  const { accessToken } = getStoredTokens();
  if (!accessToken) return null;

  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const { data } = await res.json();
      return data;
    }

    // Token expired — try refresh
    if (res.status === 401) {
      const refreshResult = await tryRefreshTokens();
      if (refreshResult) return refreshResult.user;
      clearTokens();
    }

    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser().then((fetchedUser) => {
      if (cancelled) return;
      if (fetchedUser) {
        setUser(fetchedUser);
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loginFn = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Login failed");
    }

    const { data } = await res.json();
    storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
    setUser(data.user);
    setStatus("authenticated");
  };

  const registerFn = async (email: string, password: string, name?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Registration failed");
    }

    const { data } = await res.json();
    storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
    setUser(data.user);
    setStatus("authenticated");
  };

  const logoutFn = async () => {
    const { refreshToken } = getStoredTokens();
    if (refreshToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    clearTokens();
    setUser(null);
    setStatus("unauthenticated");
  };

  return (
    <AuthContext.Provider
      value={{ user, status, login: loginFn, register: registerFn, logout: logoutFn }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getAccessToken(): string | null {
  return getStoredTokens().accessToken;
}
