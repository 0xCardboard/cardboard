"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Loader2,
  X,
  Truck,
  Clock,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getDeadlineInfo(shipDeadline: string | null): {
  label: string;
  urgency: "ok" | "warning" | "danger" | "past";
  daysRemaining: number;
} | null {
  if (!shipDeadline) return null;
  const deadline = new Date(shipDeadline);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Deadline passed", urgency: "past", daysRemaining: diffDays };
  }
  if (diffDays === 0) {
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    return {
      label: diffHours <= 0 ? "Deadline passed" : `${diffHours}h remaining`,
      urgency: diffHours <= 0 ? "past" : "danger",
      daysRemaining: 0,
    };
  }
  if (diffDays === 1) {
    return { label: "1 day remaining", urgency: "warning", daysRemaining: 1 };
  }
  return {
    label: `${diffDays} days remaining`,
    urgency: diffDays <= 2 ? "warning" : "ok",
    daysRemaining: diffDays,
  };
}

function DeadlineBadge({ shipDeadline }: { shipDeadline: string | null }) {
  const info = getDeadlineInfo(shipDeadline);
  if (!info) return null;

  const colorMap = {
    ok: "text-green-400 bg-green-500/10 border-green-500/20",
    warning: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    danger: "text-red-400 bg-red-500/10 border-red-500/20",
    past: "text-muted-foreground bg-secondary/50 border-border/40",
  };

  const Icon = info.urgency === "past" ? AlertTriangle :
    info.urgency === "danger" ? AlertTriangle : Clock;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${colorMap[info.urgency]}`}>
      <Icon className="h-3 w-3" />
      {info.label}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sideFilter, setSideFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Tracking number state for Ship Now
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingSubmitting, setShippingSubmitting] = useState(false);
  const [shippingSuccess, setShippingSuccess] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);

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

  async function handleMarkShipped(orderId: string) {
    const token = getAccessToken();
    if (!token || !trackingNumber.trim()) return;

    const order = orders.find((o) => o.id === orderId);
    if (!order?.trade || !order.cardInstance) {
      setShippingError("Missing trade or card instance info");
      return;
    }

    setShippingSubmitting(true);
    setShippingError(null);

    try {
      const res = await fetch("/api/shipments/inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tradeId: order.trade.id,
          cardInstanceId: order.cardInstance.id,
          trackingNumber: trackingNumber.trim(),
          carrier: "USPS",
        }),
      });

      if (res.ok) {
        setShippingSuccess(orderId);
        setShippingOrderId(null);
        setTrackingNumber("");
        fetchOrders();
      } else {
        const json = await res.json();
        setShippingError(json.error || "Failed to submit tracking info");
      }
    } catch {
      setShippingError("Failed to submit tracking info");
    } finally {
      setShippingSubmitting(false);
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

  // Check if a filled sell order needs shipping action
  function needsShipping(order: OrderWithDetails): boolean {
    return (
      order.side === "SELL" &&
      order.status === "FILLED" &&
      order.trade !== null &&
      (order.trade.escrowStatus === "PENDING" ||
        order.trade.escrowStatus === "CAPTURED")
    );
  }

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
                    <div className="space-y-1">
                      <Badge variant={statusVariant(order.status)} className="text-xs">
                        {order.status}
                      </Badge>
                      {/* Deadline countdown for filled sell orders */}
                      {needsShipping(order) && order.trade?.shipDeadline && (
                        <div>
                          <DeadlineBadge shipDeadline={order.trade.shipDeadline} />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Ship Now CTA for matched sell orders */}
                      {needsShipping(order) && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 gap-1 text-xs bg-primary hover:bg-primary/90"
                          onClick={() => {
                            setShippingOrderId(shippingOrderId === order.id ? null : order.id);
                            setShippingError(null);
                          }}
                        >
                          <Truck className="h-3 w-3" />
                          Ship Now
                        </Button>
                      )}
                      {/* Shipped confirmation */}
                      {shippingSuccess === order.id && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Submitted
                        </span>
                      )}
                      {/* Cancel button for open orders */}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Ship Now inline panel */}
          {shippingOrderId && (
            <div className="border-t border-border/40 bg-secondary/20 p-4">
              {(() => {
                const order = orders.find((o) => o.id === shippingOrderId);
                if (!order) return null;
                const deadlineInfo = order.trade?.shipDeadline
                  ? getDeadlineInfo(order.trade.shipDeadline)
                  : null;

                return (
                  <div className="max-w-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold font-[family-name:var(--font-display)]">
                        Ship Your Card
                      </h3>
                      {deadlineInfo && (
                        <span className="text-xs text-muted-foreground">
                          Ship by{" "}
                          <strong className="text-foreground">
                            {new Date(order.trade!.shipDeadline!).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </strong>{" "}
                          ({deadlineInfo.label})
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg bg-secondary/50 border border-border/40 p-3 text-sm text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Warehouse Address</p>
                      <p>Cardboard Warehouse, Attn: Card Verification</p>
                      <p>123 Trading Card Lane, Suite 100, Austin, TX 78701</p>
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Tracking Number
                        </label>
                        <Input
                          type="text"
                          placeholder="e.g. 9400111899223..."
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          className="h-10 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50 font-[family-name:var(--font-mono)]"
                        />
                      </div>
                      <Button
                        onClick={() => handleMarkShipped(shippingOrderId)}
                        disabled={shippingSubmitting || !trackingNumber.trim()}
                        className="h-10 rounded-xl gap-1.5"
                      >
                        {shippingSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark as Shipped
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10"
                        onClick={() => { setShippingOrderId(null); setShippingError(null); }}
                      >
                        Cancel
                      </Button>
                    </div>

                    {shippingError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" /> {shippingError}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Link
                        href="/shipping-instructions"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Packing guidelines <ExternalLink className="h-3 w-3" />
                      </Link>
                      <span>
                        Use a carrier with tracking (USPS, UPS, FedEx)
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

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
