"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
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
}

interface TradeHistoryProps {
  cardId: string;
}

export function TradeHistory({ cardId }: TradeHistoryProps) {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrades() {
      try {
        const res = await fetch(`/api/orderbook/${cardId}/trades?limit=10`);
        if (res.ok) {
          const json = await res.json();
          setTrades(json.data ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchTrades();
  }, [cardId]);

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
