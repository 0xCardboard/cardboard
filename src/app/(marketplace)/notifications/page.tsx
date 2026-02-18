"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, getAccessToken } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  TRADE_FILLED: "Trade",
  ORDER_PARTIALLY_FILLED: "Order",
  ORDER_CANCELLED: "Order",
  CARD_VERIFIED: "Verification",
  CARD_VERIFICATION_FAILED: "Verification",
  ESCROW_RELEASED: "Payment",
  SHIPMENT_UPDATE: "Shipping",
  DISPUTE_OPENED: "Dispute",
  DISPUTE_RESOLVED: "Dispute",
  SYSTEM: "System",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (filter === "unread") params.set("unreadOnly", "true");

      const res = await fetch(`/api/notifications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      setNotifications(json.data);
      setPagination(json.pagination);
      setUnreadCount(json.unreadCount);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (user) fetchNotifications();
  }, [user, status, router, fetchNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    const token = getAccessToken();
    if (!token) return;

    await fetch(`/api/notifications/${notificationId}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    const token = getAccessToken();
    if (!token) return;

    await fetch("/api/notifications/read-all", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
    );
    setUnreadCount(0);
  };

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="gap-1.5 text-muted-foreground"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setFilter("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setFilter("unread"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              filter === "unread"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            Unread
          </button>
        </div>

        {/* Notification list */}
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-xl border transition-colors ${
                  !notification.readAt
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/40 bg-card/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!notification.readAt && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <span className="text-sm font-semibold">
                        {notification.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {NOTIFICATION_TYPE_LABELS[notification.type] || notification.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1.5">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(notification.id)}
                      className="flex-shrink-0 h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
