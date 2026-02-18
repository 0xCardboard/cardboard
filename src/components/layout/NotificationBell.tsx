"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth, getAccessToken } from "@/components/providers/AuthProvider";
import { NotificationDropdown } from "./NotificationDropdown";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotificationsRef = useRef(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch("/api/notifications?limit=5", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data);
      setUnreadCount(json.unreadCount);
    } catch {
      // Silently fail — will retry on next poll
    }
  });

  // Poll for notifications every 30 seconds
  useEffect(() => {
    if (!user) return;

    const fetch = () => fetchNotificationsRef.current();
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

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

    setLoading(true);
    await fetch("/api/notifications/read-all", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
    );
    setUnreadCount(0);
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50 cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
