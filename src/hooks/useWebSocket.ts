"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAccessToken } from "@/components/providers/AuthProvider";

type MessageHandler = (data: unknown) => void;

interface UseWebSocketOptions {
  channels: string[];
  onMessage?: MessageHandler;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  connected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

const WS_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:${process.env.NEXT_PUBLIC_WS_PORT || "3001"}/ws`
    : "";

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export function useWebSocket({
  channels,
  onMessage,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const channelsRef = useRef(channels);
  const connectRef = useRef<() => void>(() => {});

  // Keep refs in sync via effects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    connectRef.current = () => {
      if (!enabled || !WS_URL) return;

      const token = getAccessToken();
      const url = token ? `${WS_URL}?token=${token}` : WS_URL;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retriesRef.current = 0;

        for (const channel of channelsRef.current) {
          ws.send(JSON.stringify({ action: "subscribe", channel }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.data && onMessageRef.current) {
            onMessageRef.current(msg.data);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (retriesRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retriesRef.current);
          retriesRef.current++;
          setTimeout(() => connectRef.current(), delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    connectRef.current();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled]);

  // Re-subscribe when channels change
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    for (const channel of channels) {
      ws.send(JSON.stringify({ action: "subscribe", channel }));
    }
  }, [channels]);

  const subscribe = useCallback((channel: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "subscribe", channel }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "unsubscribe", channel }));
    }
  }, []);

  return { connected, subscribe, unsubscribe };
}

/**
 * Subscribe to order book updates for a specific card.
 */
export function useOrderBook(
  cardId: string | null,
  onUpdate: (data: unknown) => void,
) {
  return useWebSocket({
    channels: cardId ? [`orderbook:${cardId}`] : [],
    onMessage: onUpdate,
    enabled: !!cardId,
  });
}

/**
 * Subscribe to real-time notification updates for the current user.
 */
export function useNotifications(
  userId: string | null,
  onNotification: (data: unknown) => void,
) {
  return useWebSocket({
    channels: userId ? [`notifications:${userId}`] : [],
    onMessage: onNotification,
    enabled: !!userId,
  });
}
