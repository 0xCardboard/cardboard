"use client";

import Link from "next/link";
import { Check, CheckCheck, ExternalLink } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: NotificationDropdownProps) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border/60 bg-card shadow-xl z-[100]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 border-b border-border/20 last:border-0 transition-colors ${
                !notification.readAt
                  ? "bg-primary/5 hover:bg-primary/10"
                  : "hover:bg-accent/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!notification.readAt && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium truncate">
                      {notification.title}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {timeAgo(notification.createdAt)}
                  </p>
                </div>
                {!notification.readAt && (
                  <button
                    onClick={() => onMarkRead(notification.id)}
                    className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground flex-shrink-0 cursor-pointer"
                    title="Mark as read"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/40 px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View all notifications
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
