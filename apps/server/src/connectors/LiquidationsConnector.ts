import WebSocket from "ws";
import { broadcast } from "../ws/broadcaster.js";
import type { LiquidationEvent } from "@sessionmap/types";

const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL",
  XRPUSDT: "XRP",
};
const USD_THRESHOLD = 100_000;

interface BybitLiquidationData {
  price: string;
  side: "Buy" | "Sell"; // Buy = short liq, Sell = long liq
  size: string;
  symbol: string;
  updatedTime: string;
}

interface BybitMsg {
  topic: string;
  type: string;
  data: BybitLiquidationData;
}

export function startLiquidationsConnector() {
  connect();
}

function connect() {
  const ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");

  ws.on("open", () => {
    console.log("[Liquidations] Connected to Bybit liquidation stream");
    ws.send(JSON.stringify({
      op: "subscribe",
      args: ["liquidation.BTCUSDT", "liquidation.ETHUSDT", "liquidation.SOLUSDT", "liquidation.XRPUSDT"],
    }));
  });

  ws.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as BybitMsg;
      if (!msg.topic?.startsWith("liquidation.")) return;

      const d = msg.data;
      const sym = SYMBOL_MAP[d.symbol];
      if (!sym) return;

      const price = parseFloat(d.price);
      const qty = parseFloat(d.size);
      const usdValue = price * qty;
      if (usdValue < USD_THRESHOLD) return;

      const event: LiquidationEvent = {
        id: `liq-${d.updatedTime}-${d.symbol}`,
        symbol: sym,
        side: d.side === "Buy" ? "SHORT" : "LONG",
        qty,
        price,
        usdValue,
        ts: parseInt(d.updatedTime, 10),
      };

      broadcast({ type: "liquidation", data: event });
      console.log(`[Liquidations] ${sym} ${event.side} $${(usdValue / 1000).toFixed(0)}K`);
    } catch {
      // ignore malformed
    }
  });

  ws.on("close", () => {
    console.log("[Liquidations] Disconnected, reconnecting in 5s...");
    setTimeout(connect, 5_000);
  });

  ws.on("error", (err) => {
    console.error("[Liquidations] WS error:", err.message);
  });
}
