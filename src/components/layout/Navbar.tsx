"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User, X } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "./NotificationBell";

export function Navbar() {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 glass">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center transition-colors group-hover:bg-primary/15">
            <span className="text-primary font-bold text-sm font-[family-name:var(--font-display)]">C</span>
          </div>
          <span className="text-lg font-bold tracking-tight font-[family-name:var(--font-display)]">
            Cardboard
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/cards"
            className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
          >
            Browse
          </Link>
          {user && (
            <>
              <Link
                href="/sell"
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
              >
                Sell
              </Link>
              <Link
                href="/vault"
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
              >
                Vault
              </Link>
              <Link
                href="/orders"
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
              >
                Trades
              </Link>
              <Link
                href="/portfolio"
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
              >
                Portfolio
              </Link>
            </>
          )}
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-3">
          {status === "loading" ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          ) : user ? (
            <>
              <NotificationBell />
              <button
                onClick={() => router.push(`/profile/${user.id}`)}
                className="relative z-[60] flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50 cursor-pointer"
              >
                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                {user.name || user.email}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild className="font-semibold">
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-accent/50 text-muted-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 glass">
          <div className="container mx-auto px-4 py-4 space-y-1">
            <Link
              href="/cards"
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
              onClick={() => setMobileOpen(false)}
            >
              Browse Cards
            </Link>
            {user && (
              <>
                <Link
                  href="/sell"
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  onClick={() => setMobileOpen(false)}
                >
                  Sell a Card
                </Link>
                <Link
                  href="/vault"
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  onClick={() => setMobileOpen(false)}
                >
                  Vault a Card
                </Link>
                <Link
                  href="/orders"
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  onClick={() => setMobileOpen(false)}
                >
                  My Trades
                </Link>
                <Link
                  href="/portfolio"
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  onClick={() => setMobileOpen(false)}
                >
                  Portfolio
                </Link>
              </>
            )}
            <div className="pt-3 border-t border-border/40">
              {user ? (
                <div className="space-y-1">
                  <button
                    onClick={() => { router.push(`/profile/${user.id}`); setMobileOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer w-full"
                  >
                    <User className="h-3.5 w-3.5" />
                    My Profile
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="w-full justify-start gap-2 text-muted-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
                  </Button>
                  <Button size="sm" asChild className="flex-1 font-semibold">
                    <Link href="/register" onClick={() => setMobileOpen(false)}>Get Started</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
