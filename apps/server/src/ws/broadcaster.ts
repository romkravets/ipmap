import { WebSocketServer, WebSocket } from "ws";
import type { WsMessage } from "@sessionmap/types";

const clients = new Set<WebSocket>();

export function createBroadcaster(wss: WebSocketServer) {
  wss.on("connection", (ws, req) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on("error", (err) => {
      console.error("[WS] Client error:", err.message);
      clients.delete(ws);
    });

    // Send pings to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30_000);
  });
}

export function broadcast(msg: WsMessage) {
  const payload = JSON.stringify(msg);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export function sendSnapshot(ws: WebSocket, msg: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function getClientCount() {
  return clients.size;
}
