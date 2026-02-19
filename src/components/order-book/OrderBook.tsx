"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { formatPrice } from "@/lib/format";
import { useOrderBook as useOrderBookWs } from "@/hooks/useWebSocket";
import type { OrderBookSnapshot, OrderBookEntry } from "@/types/order";

interface OrderBookProps {
  cardId: string;
  initialData?: OrderBookSnapshot;
}

const POLL_INTERVAL_FALLBACK = 10_000; // 10s fallback when WS disconnected

export function OrderBook({ cardId, initialData }: OrderBookProps) {
  const [data, setData] = useState<OrderBookSnapshot | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // WebSocket: real-time order book updates trigger a fresh fetch
  const handleWsUpdate = useCallback(() => {
    fetchOrderBook();
  }, [fetchOrderBook]);

  const { connected } = useOrderBookWs(cardId, handleWsUpdate);

  // Initial fetch
  useEffect(() => {
    fetchOrderBook();
  }, [fetchOrderBook]);

  // Fallback: poll when WebSocket is not connected
  useEffect(() => {
    if (connected) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(fetchOrderBook, POLL_INTERVAL_FALLBACK);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [connected, fetchOrderBook]);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Loading order book...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm">{error}</div>
    );
  }

  if (!data) return null;

  const maxBidQty = Math.max(...data.bids.map((b) => b.quantity), 1);
  const maxAskQty = Math.max(...data.asks.map((a) => a.quantity), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)]">Order Book</h2>
          {connected ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 px-1.5 py-0.5">
              Polling
            </span>
          )}
        </div>
        {data.spread !== null && (
          <span className="text-xs font-[family-name:var(--font-mono)] text-muted-foreground px-2 py-1 rounded-lg bg-secondary/50">
            Spread: {formatPrice(data.spread)}
          </span>
        )}
      </div>

      {data.lastTradePrice !== null && (
        <div className="text-sm text-muted-foreground">
          Last trade:{" "}
          <span className="font-medium text-foreground font-[family-name:var(--font-mono)]">
            {formatPrice(data.lastTradePrice)}
          </span>
          {data.lastTradeTime && (
            <span className="ml-2 text-xs">
              ({new Date(data.lastTradeTime).toLocaleString()})
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Bids (buy orders) */}
        <div>
          <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground pb-2 border-b border-border/30">
            <span>Orders</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price</span>
          </div>
          <div className="space-y-px mt-1">
            {data.bids.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No bids
              </div>
            ) : (
              data.bids.slice(0, 10).map((entry, i) => (
                <OrderBookRow key={i} entry={entry} maxQty={maxBidQty} side="bid" />
              ))
            )}
          </div>
        </div>

        {/* Asks (sell orders) */}
        <div>
          <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground pb-2 border-b border-border/30">
            <span>Price</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Orders</span>
          </div>
          <div className="space-y-px mt-1">
            {data.asks.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No asks
              </div>
            ) : (
              data.asks.slice(0, 10).map((entry, i) => (
                <OrderBookRow key={i} entry={entry} maxQty={maxAskQty} side="ask" />
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
  const bgColor = side === "bid" ? "bg-green-500/8" : "bg-red-500/8";
  const textColor = side === "bid" ? "text-green-400" : "text-red-400";

  return (
    <div className="relative rounded-sm">
      <div
        className={`absolute inset-y-0 ${side === "bid" ? "right-0" : "left-0"} ${bgColor} rounded-sm`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative grid grid-cols-3 gap-1 text-xs py-1 px-1">
        {side === "bid" ? (
          <>
            <span className="text-muted-foreground">{entry.orderCount}</span>
            <span className="text-right">{entry.quantity}</span>
            <span className={`text-right font-medium font-[family-name:var(--font-mono)] ${textColor}`}>
              {formatPrice(entry.price)}
            </span>
          </>
        ) : (
          <>
            <span className={`font-medium font-[family-name:var(--font-mono)] ${textColor}`}>
              {formatPrice(entry.price)}
            </span>
            <span className="text-right">{entry.quantity}</span>
            <span className="text-right text-muted-foreground">{entry.orderCount}</span>
          </>
        )}
      </div>
    </div>
  );
}
