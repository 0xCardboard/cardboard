"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OrderFormProps {
  cardId: string;
}

export function OrderForm({ cardId }: OrderFormProps) {
  const router = useRouter();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Get token from localStorage
    const token = localStorage.getItem("accessToken");
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Place Order</h2>

      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={side === "BUY" ? "default" : "outline"}
          onClick={() => setSide("BUY")}
          className={side === "BUY" ? "bg-green-600 hover:bg-green-700" : ""}
        >
          Buy
        </Button>
        <Button
          variant={side === "SELL" ? "default" : "outline"}
          onClick={() => setSide("SELL")}
          className={side === "SELL" ? "bg-red-600 hover:bg-red-700" : ""}
        >
          Sell
        </Button>
      </div>

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={type === "LIMIT" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setType("LIMIT")}
        >
          Limit
        </Button>
        <Button
          variant={type === "MARKET" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setType("MARKET")}
        >
          Market
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {type === "LIMIT" && (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Price (USD)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        )}

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">
            Quantity
          </label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {success && (
          <p className="text-sm text-green-600">{success}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className={`w-full ${
            side === "BUY"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading
            ? "Placing order..."
            : `${side === "BUY" ? "Buy" : "Sell"} ${type === "MARKET" ? "(Market)" : ""}`}
        </Button>
      </form>
    </div>
  );
}
