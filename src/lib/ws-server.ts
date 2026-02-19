import "dotenv/config";
import { createServer } from "http";
import { initWebSocketServer, subscribeToRedis } from "./websocket";

const PORT = parseInt(process.env.WS_PORT || "3001", 10);

const server = createServer((_req, res) => {
  res.writeHead(200);
  res.end("WebSocket server running");
});

initWebSocketServer(server);
subscribeToRedis();

server.listen(PORT, () => {
  console.log(`[ws] WebSocket server listening on port ${PORT}`);
});
