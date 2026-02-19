"use client";

import { useEffect, useState, useCallback } from "react";
import { formatPrice } from "@/lib/format";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TradeEntry {
  id: string;
  price: number;
  quantity: number;
  createdAt: string;
  certNumber: string | null;
}

interface TradeHistoryProps {
  cardId: string;
}

const MAX_DISPLAY = 10;

export function TradeHistory({ cardId }: TradeHistoryProps) {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch(`/api/orderbook/${cardId}/trades?limit=${MAX_DISPLAY}`);
      if (res.ok) {
        const json = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (json.data ?? []).map((t: any) => ({
          id: t.id,
          price: t.price,
          quantity: t.quantity,
          createdAt: t.createdAt,
          certNumber: t.sellOrder?.cardInstance?.certNumber ?? null,
        }));
        setTrades(mapped);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  // WebSocket: listen for new trades on this card
  const handleWsTrade = useCallback(
    (data: unknown) => {
      const trade = data as { tradeId?: string; price?: number; quantity?: number; timestamp?: string; certNumber?: string };
      if (trade.tradeId && trade.price !== undefined) {
        setTrades((prev) => {
          const entry: TradeEntry = {
            id: trade.tradeId!,
            price: trade.price!,
            quantity: trade.quantity ?? 1,
            createdAt: trade.timestamp ?? new Date().toISOString(),
            certNumber: trade.certNumber ?? null,
          };
          // Prepend and cap at MAX_DISPLAY
          return [entry, ...prev].slice(0, MAX_DISPLAY);
        });
      }
    },
    [],
  );

  useWebSocket({
    channels: cardId ? [`trades:${cardId}`] : [],
    onMessage: handleWsTrade,
    enabled: !!cardId,
  });

  // Initial fetch
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Loading trade history...
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No trades yet for this card.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 font-[family-name:var(--font-display)]">Recent Trades</h2>
      <Table>
        <TableHeader>
          <TableRow className="border-border/30 hover:bg-transparent">
            <TableHead>Price</TableHead>
            <TableHead>Cert #</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.id} className="border-border/20 hover:bg-accent/20">
              <TableCell className="font-medium font-[family-name:var(--font-mono)]">
                {formatPrice(trade.price)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm font-[family-name:var(--font-mono)]">
                {trade.certNumber ?? "—"}
              </TableCell>
              <TableCell className="text-right">{trade.quantity}</TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {new Date(trade.createdAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
