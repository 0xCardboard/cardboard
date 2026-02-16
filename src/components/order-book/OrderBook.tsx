"use client";

import { useEffect, useState, useCallback } from "react";
import { formatPrice } from "@/lib/format";
import type { OrderBookSnapshot, OrderBookEntry } from "@/types/order";

interface OrderBookProps {
  cardId: string;
  initialData?: OrderBookSnapshot;
}

export function OrderBook({ cardId, initialData }: OrderBookProps) {
  const [data, setData] = useState<OrderBookSnapshot | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/orderbook/${cardId}`);
      if (!res.ok) throw new Error("Failed to fetch order book");
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order book");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (!initialData) fetchOrderBook();

    // Poll every 5 seconds (will be replaced by WebSocket in Phase 1E)
    const interval = setInterval(fetchOrderBook, 5000);
    return () => clearInterval(interval);
  }, [fetchOrderBook, initialData]);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading order book...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">{error}</div>
    );
  }

  if (!data) return null;

  const maxBidQty = Math.max(...data.bids.map((b) => b.quantity), 1);
  const maxAskQty = Math.max(...data.asks.map((a) => a.quantity), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Order Book</h2>
        {data.spread !== null && (
          <span className="text-sm text-muted-foreground">
            Spread: {formatPrice(data.spread)}
          </span>
        )}
      </div>

      {data.lastTradePrice !== null && (
        <div className="text-sm text-muted-foreground">
          Last trade: {formatPrice(data.lastTradePrice)}
          {data.lastTradeTime && (
            <span className="ml-2">
              ({new Date(data.lastTradeTime).toLocaleString()})
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Bids (buy orders) */}
        <div>
          <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground pb-2 border-b">
            <span>Orders</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price</span>
          </div>
          <div className="space-y-0.5 mt-1">
            {data.bids.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">
                No bids
              </div>
            ) : (
              data.bids.slice(0, 10).map((entry, i) => (
                <OrderBookRow
                  key={i}
                  entry={entry}
                  maxQty={maxBidQty}
                  side="bid"
                />
              ))
            )}
          </div>
        </div>

        {/* Asks (sell orders) */}
        <div>
          <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground pb-2 border-b">
            <span>Price</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Orders</span>
          </div>
          <div className="space-y-0.5 mt-1">
            {data.asks.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">
                No asks
              </div>
            ) : (
              data.asks.slice(0, 10).map((entry, i) => (
                <OrderBookRow
                  key={i}
                  entry={entry}
                  maxQty={maxAskQty}
                  side="ask"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderBookRow({
  entry,
  maxQty,
  side,
}: {
  entry: OrderBookEntry;
  maxQty: number;
  side: "bid" | "ask";
}) {
  const pct = (entry.quantity / maxQty) * 100;
  const bgColor = side === "bid" ? "bg-green-500/10" : "bg-red-500/10";
  const textColor = side === "bid" ? "text-green-600" : "text-red-600";

  return (
    <div className="relative">
      <div
        className={`absolute inset-y-0 ${side === "bid" ? "right-0" : "left-0"} ${bgColor}`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative grid grid-cols-3 gap-1 text-xs py-0.5">
        {side === "bid" ? (
          <>
            <span className="text-muted-foreground">{entry.orderCount}</span>
            <span className="text-right">{entry.quantity}</span>
            <span className={`text-right font-medium ${textColor}`}>
              {formatPrice(entry.price)}
            </span>
          </>
        ) : (
          <>
            <span className={`font-medium ${textColor}`}>
              {formatPrice(entry.price)}
            </span>
            <span className="text-right">{entry.quantity}</span>
            <span className="text-right text-muted-foreground">
              {entry.orderCount}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
