"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    const token = localStorage.getItem("accessToken");
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
    const token = localStorage.getItem("accessToken");
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
        <h1 className="text-3xl font-bold mb-6">My Orders</h1>
        <p className="text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant={sideFilter === "" ? "default" : "outline"}
          size="sm"
          onClick={() => { setSideFilter(""); setPage(1); }}
        >
          All
        </Button>
        <Button
          variant={sideFilter === "BUY" ? "default" : "outline"}
          size="sm"
          onClick={() => { setSideFilter("BUY"); setPage(1); }}
        >
          Buys
        </Button>
        <Button
          variant={sideFilter === "SELL" ? "default" : "outline"}
          size="sm"
          onClick={() => { setSideFilter("SELL"); setPage(1); }}
        >
          Sells
        </Button>
        <span className="border-l mx-2" />
        <Button
          variant={statusFilter === "" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => { setStatusFilter(""); setPage(1); }}
        >
          Any Status
        </Button>
        <Button
          variant={statusFilter === "OPEN" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => { setStatusFilter("OPEN"); setPage(1); }}
        >
          Open
        </Button>
        <Button
          variant={statusFilter === "FILLED" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => { setStatusFilter("FILLED"); setPage(1); }}
        >
          Filled
        </Button>
        <Button
          variant={statusFilter === "CANCELLED" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => { setStatusFilter("CANCELLED"); setPage(1); }}
        >
          Cancelled
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground">
          No orders found.{" "}
          <Link href="/cards" className="text-primary hover:underline">
            Browse cards
          </Link>{" "}
          to start trading.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/cards/${order.card.id}`}
                      className="hover:underline font-medium"
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
                    >
                      {order.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.type}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.price ? formatPrice(order.price) : "Market"}
                  </TableCell>
                  <TableCell className="text-right">{order.quantity}</TableCell>
                  <TableCell className="text-right">
                    {order.filledQuantity}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(order.status === "OPEN" ||
                      order.status === "PARTIALLY_FILLED") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancelling === order.id}
                        onClick={() => handleCancel(order.id)}
                      >
                        {cancelling === order.id ? "..." : "Cancel"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} orders)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
