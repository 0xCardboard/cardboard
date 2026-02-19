"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, getAccessToken } from "@/components/providers/AuthProvider";
import { formatPrice } from "@/lib/format";
import type { OrderBookSnapshot } from "@/types/order";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  ExternalLink,
  Info,
} from "lucide-react";

interface OrderFormProps {
  cardId: string;
}

const GRADING_COMPANY = "PSA" as const;
const LAUNCH_GRADE = 10;

export function OrderForm({ cardId }: OrderFormProps) {
  const router = useRouter();
  const { status } = useAuth();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [certNumber, setCertNumber] = useState("");
  const [certError, setCertError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    message: string;
    side: "BUY" | "SELL";
  } | null>(null);

  // Order book context for sell side
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [loadingOB, setLoadingOB] = useState(false);

  const fetchOrderBook = useCallback(async () => {
    setLoadingOB(true);
    try {
      const res = await fetch(`/api/orderbook/${cardId}`);
      if (res.ok) {
        const json = await res.json();
        setOrderBook(json.data ?? null);
      }
    } catch {
      // Silently handle
    } finally {
      setLoadingOB(false);
    }
  }, [cardId]);

  // Fetch order book on mount (useful for both buy and sell context)
  useEffect(() => {
    fetchOrderBook();
  }, [fetchOrderBook]);

  function validateCertNumber(value: string): string | null {
    if (!value.trim()) return "Certificate number is required";
    if (!/^\d{5,10}$/.test(value.trim())) return "PSA cert numbers are 5-10 digits";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const token = getAccessToken();
    if (!token) {
      setError("Please log in to place an order");
      setLoading(false);
      return;
    }

    // Validate cert number for sell orders
    if (side === "SELL") {
      const err = validateCertNumber(certNumber);
      if (err) {
        setCertError(err);
        setLoading(false);
        return;
      }
    }

    try {
      const body: Record<string, unknown> = {
        cardId,
        side,
        type,
        quantity: parseInt(quantity) || 1,
      };

      if (type === "LIMIT") {
        const priceInCents = Math.round(parseFloat(price) * 100);
        if (isNaN(priceInCents) || priceInCents <= 0) {
          throw new Error("Please enter a valid price");
        }
        body.price = priceInCents;
      }

      if (side === "SELL") {
        body.certNumber = certNumber.trim();
        body.gradingCompany = GRADING_COMPANY;
        body.grade = LAUNCH_GRADE;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to place order");
      }

      setSuccess({
        message: `${side} order placed successfully`,
        side,
      });
      setPrice("");
      setQuantity("1");
      setCertNumber("");
      setCertError(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setLoading(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">Place Order</h2>
        <p className="text-sm text-muted-foreground">
          Please log in to place orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">Place Order</h2>

      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary/50">
        <button
          onClick={() => { setSide("BUY"); setSuccess(null); setError(null); }}
          className={`py-2 rounded-lg text-sm font-semibold transition-all ${
            side === "BUY"
              ? "bg-green-500/20 text-green-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setSide("SELL"); setSuccess(null); setError(null); }}
          className={`py-2 rounded-lg text-sm font-semibold transition-all ${
            side === "SELL"
              ? "bg-red-500/20 text-red-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Sell-side context info */}
      {side === "SELL" && (
        <div className="rounded-lg bg-secondary/30 border border-border/40 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Info className="h-3 w-3" /> Market Info
          </div>
          {loadingOB ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : orderBook ? (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Best Bid</span>
                <p className="font-semibold font-[family-name:var(--font-mono)] text-green-400">
                  {orderBook.bids.length > 0 ? formatPrice(orderBook.bids[0].price) : "---"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Trade</span>
                <p className="font-semibold font-[family-name:var(--font-mono)]">
                  {orderBook.lastTradePrice ? formatPrice(orderBook.lastTradePrice) : "---"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Spread</span>
                <p className="font-semibold font-[family-name:var(--font-mono)]">
                  {orderBook.spread !== null ? formatPrice(orderBook.spread) : "---"}
                </p>
              </div>
            </div>
          ) : null}
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            When matched, you&apos;ll ship this card to our warehouse for verification.
          </p>
        </div>
      )}

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary/50">
        <button
          onClick={() => setType("LIMIT")}
          className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
            type === "LIMIT"
              ? "bg-accent text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setType("MARKET")}
          className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
            type === "MARKET"
              ? "bg-accent text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Market
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {type === "LIMIT" && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Price (USD)</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="h-10 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 font-[family-name:var(--font-mono)]"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="h-10 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50"
          />
        </div>

        {/* Sell-side card details */}
        {side === "SELL" && (
          <>
            <div className="border-t border-border/30 pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Card Details
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Grading Company</label>
                <div className="flex h-10 w-full items-center rounded-xl border border-border/60 bg-secondary/50 px-3 text-sm font-medium">
                  {GRADING_COMPANY}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Grade</label>
                <div className="flex h-10 w-full items-center rounded-xl border border-border/60 bg-secondary/50 px-3 text-sm font-medium font-[family-name:var(--font-mono)]">
                  {LAUNCH_GRADE}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PSA 10 only at launch</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Certificate Number</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 44589233"
                value={certNumber}
                onChange={(e) => {
                  setCertNumber(e.target.value.replace(/\D/g, ""));
                  setCertError(null);
                }}
                required
                className={`h-10 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 font-[family-name:var(--font-mono)] ${
                  certError ? "border-destructive" : ""
                }`}
              />
              {certError && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {certError}
                </p>
              )}
            </div>

            {/* PSA Scan Preview */}
            {certNumber.length >= 5 && (
              <a
                href={`https://www.psacard.com/cert/${certNumber.trim()}/psa`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Verify cert on PSA <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-green-400">{success.message}</p>
            </div>
            {success.side === "SELL" && (
              <div className="text-xs text-muted-foreground pl-6 space-y-1">
                <p>Check your <Link href="/orders" className="text-primary hover:underline">trades page</Link> for status.</p>
                <p>Ship within 3 business days after matching.</p>
              </div>
            )}
            {success.side === "BUY" && (
              <div className="text-xs text-muted-foreground pl-6">
                <p>Track your trade on the <Link href="/orders" className="text-primary hover:underline">trades page</Link>.</p>
              </div>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className={`w-full h-11 rounded-xl font-semibold ${
            side === "BUY"
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `${side === "BUY" ? "Buy" : "Sell"} ${type === "MARKET" ? "(Market)" : ""}`
          )}
        </Button>
      </form>
    </div>
  );
}
