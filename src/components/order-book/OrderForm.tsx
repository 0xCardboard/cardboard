"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, getAccessToken } from "@/components/providers/AuthProvider";
import { Loader2, CheckCircle2, AlertCircle, Lock } from "lucide-react";

interface OrderFormProps {
  cardId: string;
}

const GRADING_COMPANIES = ["PSA", "BGS", "CGC"] as const;

export function OrderForm({ cardId }: OrderFormProps) {
  const router = useRouter();
  const { status } = useAuth();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [certNumber, setCertNumber] = useState("");
  const [gradingCompany, setGradingCompany] = useState<"PSA" | "BGS" | "CGC">("PSA");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        if (!certNumber.trim()) {
          throw new Error("Please enter the certificate number");
        }
        const gradeNum = parseFloat(grade);
        if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 10) {
          throw new Error("Please enter a valid grade (1-10)");
        }
        body.certNumber = certNumber.trim();
        body.gradingCompany = gradingCompany;
        body.grade = gradeNum;
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

      setSuccess(`${side} order placed successfully`);
      setPrice("");
      setQuantity("1");
      setCertNumber("");
      setGrade("");
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
          onClick={() => setSide("BUY")}
          className={`py-2 rounded-lg text-sm font-semibold transition-all ${
            side === "BUY"
              ? "bg-green-500/20 text-green-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={`py-2 rounded-lg text-sm font-semibold transition-all ${
            side === "SELL"
              ? "bg-red-500/20 text-red-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sell
        </button>
      </div>

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
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grading Company</label>
              <select
                value={gradingCompany}
                onChange={(e) => setGradingCompany(e.target.value as "PSA" | "BGS" | "CGC")}
                className="flex h-10 w-full rounded-xl border border-border/60 bg-secondary/50 px-3 py-1 text-sm transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {GRADING_COMPANIES.map((gc) => (
                  <option key={gc} value={gc}>{gc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Certificate Number</label>
              <Input
                type="text"
                placeholder="e.g. 12345678"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                required
                className="h-10 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 font-[family-name:var(--font-mono)]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grade</label>
              <Input
                type="number"
                step="0.5"
                min="1"
                max="10"
                placeholder="e.g. 9.5"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                required
                className="h-10 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 font-[family-name:var(--font-mono)]"
              />
            </div>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-400">{success}</p>
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
