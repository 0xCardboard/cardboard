import Redis from "ioredis";

const REDIS_CHANNEL = "ws:broadcast";

let pub: Redis | null = null;

function getPublisher(): Redis {
  if (!pub) {
    pub = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    pub.connect().catch(() => {
      // Redis may not be available — publish calls will silently fail
    });
  }
  return pub;
}

/**
 * Publish a message to a WebSocket channel via Redis pub/sub.
 * This can be called from any process (Next.js API, workers, etc.).
 * The standalone WebSocket server subscribes to these messages
 * and forwards them to connected clients.
 */
export function publish(channel: string, data: unknown): void {
  const message = JSON.stringify({ channel, data });
  getPublisher().publish(REDIS_CHANNEL, message).catch(() => {
    // Silently ignore — WS updates are best-effort
  });
}
