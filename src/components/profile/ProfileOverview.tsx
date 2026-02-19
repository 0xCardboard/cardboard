"use client";

import Link from "next/link";
import {
  TrendingUp,
  Package,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShoppingCart,
  Wallet,
} from "lucide-react";


interface ProfileData {
  reputation: {
    score: number;
    totalTrades: number;
    successfulTrades: number;
    avgShipTimeDays: number;
    disputeCount: number;
  } | null;
  _count: {
    cardInstances: number;
    orders: number;
    buyTrades: number;
    sellTrades: number;
    reviewsReceived: number;
  };
}

export function ProfileOverview({ profile }: { profile: ProfileData }) {
  const rep = profile.reputation;
  const successRate =
    rep && rep.totalTrades > 0
      ? ((rep.successfulTrades / rep.totalTrades) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-6">
      {/* Reputation details */}
      <div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">
          Reputation Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <TrendingUp className="h-4.5 w-4.5 text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
            <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">{successRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {rep?.successfulTrades ?? 0} of {rep?.totalTrades ?? 0} trades
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Clock className="h-4.5 w-4.5 text-blue-400" />
              </div>
              <p className="text-sm text-muted-foreground">Avg Ship Time</p>
            </div>
            <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">
              {rep?.avgShipTimeDays.toFixed(1) ?? "0"} days
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="h-4.5 w-4.5 text-orange-400" />
              </div>
              <p className="text-sm text-muted-foreground">Disputes</p>
            </div>
            <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">
              {rep?.disputeCount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Package className="h-4.5 w-4.5 text-purple-400" />
              </div>
              <p className="text-sm text-muted-foreground">Active Trades</p>
            </div>
            <p className="text-2xl font-bold font-[family-name:var(--font-mono)]">
              {profile._count.orders}
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">
          Quick Links
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/portfolio"
            className="group rounded-2xl border border-border/50 bg-card/50 p-5 transition-colors hover:bg-accent/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Wallet className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">My Portfolio</p>
                  <p className="text-sm text-muted-foreground">
                    {profile._count.cardInstances} cards
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/orders"
            className="group rounded-2xl border border-border/50 bg-card/50 p-5 transition-colors hover:bg-accent/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ShoppingCart className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">My Trades</p>
                  <p className="text-sm text-muted-foreground">
                    {profile._count.orders} trades
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/cards"
            className="group rounded-2xl border border-border/50 bg-card/50 p-5 transition-colors hover:bg-accent/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Browse Marketplace</p>
                  <p className="text-sm text-muted-foreground">Find new cards to trade</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
