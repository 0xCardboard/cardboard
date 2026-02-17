"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAccessToken } from "@/components/providers/AuthProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format";
import type { OrderWithDetails } from "@/types/order";
import { Loader2, X } from "lucide-react";

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sideFilter, setSideFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (sideFilter) params.set("side", sideFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", page.toString());

      const res = await fetch(`/api/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setOrders(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [sideFilter, statusFilter, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function handleCancel(orderId: string) {
    const token = getAccessToken();
    if (!token) return;

    setCancelling(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchOrders();
      }
    } catch {
      // Silently handle errors
    } finally {
      setCancelling(null);
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "OPEN":
        return "default" as const;
      case "PARTIALLY_FILLED":
        return "secondary" as const;
      case "FILLED":
        return "outline" as const;
      case "CANCELLED":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 font-[family-name:var(--font-display)]">My Orders</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading orders...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">My Orders</h1>
        <p className="text-muted-foreground mt-1">Track and manage your open and filled orders.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { label: "All", value: "", type: "side" },
          { label: "Buys", value: "BUY", type: "side" },
          { label: "Sells", value: "SELL", type: "side" },
        ].map((f) => (
          <Button
            key={f.label}
            variant={sideFilter === f.value ? "default" : "outline"}
            size="sm"
            className="rounded-lg"
            onClick={() => { setSideFilter(f.value); setPage(1); }}
          >
            {f.label}
          </Button>
        ))}
        <span className="border-l border-border/40 mx-1" />
        {[
          { label: "Any Status", value: "" },
          { label: "Open", value: "OPEN" },
          { label: "Filled", value: "FILLED" },
          { label: "Cancelled", value: "CANCELLED" },
        ].map((f) => (
          <Button
            key={f.label}
            variant={statusFilter === f.value ? "secondary" : "ghost"}
            size="sm"
            className="rounded-lg"
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">
            No orders found.{" "}
            <Link href="/cards" className="text-primary hover:underline">
              Browse cards
            </Link>{" "}
            to start trading.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Card</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Filled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="border-border/30 hover:bg-accent/30">
                  <TableCell>
                    <Link
                      href={`/cards/${order.card.id}`}
                      className="hover:underline font-medium hover:text-primary transition-colors"
                    >
                      {order.card.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {order.card.set.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={order.side === "BUY" ? "default" : "destructive"}
                      className="font-mono text-xs"
                    >
                      {order.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {order.type}
                  </TableCell>
                  <TableCell className="text-right font-[family-name:var(--font-mono)]">
                    {order.avgFillPrice ? (
                      <>
                        {formatPrice(order.avgFillPrice)}
                        {order.price && order.price !== order.avgFillPrice && (
                          <div className="text-xs text-muted-foreground">
                            Limit: {formatPrice(order.price)}
                          </div>
                        )}
                      </>
                    ) : order.price ? (
                      formatPrice(order.price)
                    ) : (
                      <span className="text-muted-foreground">Market</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{order.quantity}</TableCell>
                  <TableCell className="text-right">{order.filledQuantity}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)} className="text-xs">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(order.status === "OPEN" || order.status === "PARTIALLY_FILLED") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        disabled={cancelling === order.id}
                        onClick={() => handleCancel(order.id)}
                      >
                        {cancelling === order.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/30">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} orders)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
