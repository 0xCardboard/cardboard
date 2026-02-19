import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import Redis from "ioredis";
import { verifyAccessToken } from "@/services/auth.service";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  channels: Set<string>;
  isAlive: boolean;
}

let wss: WebSocketServer | null = null;

// Map of channel name → set of connected sockets
const channels = new Map<string, Set<AuthenticatedSocket>>();

/**
 * Initialize the WebSocket server on an existing HTTP server.
 */
export function initWebSocketServer(server: Server): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const socket = ws as AuthenticatedSocket;
    socket.channels = new Set();
    socket.isAlive = true;

    // Authenticate via token in query string
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        socket.userId = payload.sub;
      } catch {
        socket.close(4001, "Invalid token");
        return;
      }
    }

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(socket, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on("close", () => {
      // Remove from all channels
      for (const channel of socket.channels) {
        const sockets = channels.get(channel);
        if (sockets) {
          sockets.delete(socket);
          if (sockets.size === 0) channels.delete(channel);
        }
      }
    });
  });

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    if (!wss) return;
    for (const ws of wss.clients) {
      const socket = ws as AuthenticatedSocket;
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
}

/**
 * Handle incoming client messages (subscribe/unsubscribe).
 */
function handleMessage(
  socket: AuthenticatedSocket,
  msg: { action: string; channel: string },
): void {
  const { action, channel } = msg;
  if (!channel || typeof channel !== "string") return;

  // User-specific channels require authentication
  if (channel.startsWith("notifications:") && !socket.userId) {
    socket.send(
      JSON.stringify({ error: "Authentication required for notification channels" }),
    );
    return;
  }

  // Ensure user can only subscribe to their own notification channel
  if (channel.startsWith("notifications:") && channel !== `notifications:${socket.userId}`) {
    socket.send(JSON.stringify({ error: "Cannot subscribe to other users' notifications" }));
    return;
  }

  if (action === "subscribe") {
    socket.channels.add(channel);
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel)!.add(socket);
    socket.send(JSON.stringify({ action: "subscribed", channel }));
  } else if (action === "unsubscribe") {
    socket.channels.delete(channel);
    const sockets = channels.get(channel);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) channels.delete(channel);
    }
    socket.send(JSON.stringify({ action: "unsubscribed", channel }));
  }
}


/**
 * Get the current WebSocket server instance.
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

const REDIS_CHANNEL = "ws:broadcast";

/**
 * Subscribe to Redis pub/sub and forward messages to local WebSocket clients.
 * Call this once at WS server startup so that publish() calls from
 * other processes (Next.js API, workers) reach connected browsers.
 */
export function subscribeToRedis(): void {
  const sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  sub.subscribe(REDIS_CHANNEL).catch((err) => {
    console.error("[ws] Failed to subscribe to Redis channel:", err);
  });

  sub.on("message", (_redisChannel: string, message: string) => {
    try {
      const { channel, data } = JSON.parse(message);
      broadcastToChannel(channel, data);
    } catch {
      // Ignore malformed messages
    }
  });

  console.log("[ws] Subscribed to Redis pub/sub for broadcast messages");
}

/**
 * Broadcast a message to all WebSocket clients subscribed to a channel.
 */
function broadcastToChannel(channel: string, data: unknown): void {
  const sockets = channels.get(channel);
  if (!sockets || sockets.size === 0) return;

  const message = JSON.stringify({ channel, data });

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}
