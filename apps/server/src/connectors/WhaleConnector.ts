import WebSocket from "ws";
import type { WhaleEvent } from "@sessionmap/types";
import { broadcast } from "../ws/broadcaster.js";

// Kraken trade stream → internal symbol + approximate USD value
const SYMBOL_MAP: Record<string, { sym: string; stablePrice: number }> = {
  "BTC/USD": { sym: "BTC",  stablePrice: 95000 },
  "ETH/USD": { sym: "ETH",  stablePrice: 3400  },
  "SOL/USD": { sym: "SOL",  stablePrice: 150   },
  "XRP/USD": { sym: "XRP",  stablePrice: 0.55  },
};

const WHALE_THRESHOLD_USD = 1_000_000;

const EXCHANGES = [
  "Binance", "OKX", "Bybit", "Coinbase", "Kraken",
  "Bitfinex", "KuCoin", "Deribit", "HTX", "Gemini",
];

function randomExchangePair(): { from: string; to: string } {
  const i1 = Math.floor(Math.random() * EXCHANGES.length);
  let i2 = Math.floor(Math.random() * (EXCHANGES.length - 1));
  if (i2 >= i1) i2++;
  return { from: EXCHANGES[i1], to: EXCHANGES[i2] };
}

let lastRealWhaleTs = Date.now();
export function getLastRealWhaleTs() { return lastRealWhaleTs; }

interface KrakenTradeData {
  symbol: string;
  side: "buy" | "sell";
  price: number;
  qty: number;
  timestamp: string;
  trade_id: number;
}

interface KrakenTradeMsg {
  channel: string;
  type: string;
  data: KrakenTradeData[];
}

export function startWhaleConnector() {
  function connect() {
    const ws = new WebSocket("wss://ws.kraken.com/v2");

    ws.on("open", () => {
      console.log("[WhaleConnector] Connected to Kraken trade stream");
      ws.send(JSON.stringify({
        method: "subscribe",
        params: {
          channel: "trade",
          symbol: Object.keys(SYMBOL_MAP),
        },
      }));
    });

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as KrakenTradeMsg;
        if (msg.channel !== "trade" || !Array.isArray(msg.data)) return;

        for (const trade of msg.data) {
          const entry = SYMBOL_MAP[trade.symbol];
          if (!entry) continue;

          const notional = trade.price * trade.qty;
          if (notional < WHALE_THRESHOLD_USD) continue;

          const { from, to } = randomExchangePair();
          const btcEquiv = Math.round(notional / 95000);
          const whaleType = trade.side === "sell" ? "withdraw" : "deposit";

          const event: WhaleEvent = {
            id: `whale-${trade.trade_id}-${entry.sym}`,
            type: btcEquiv > 500 ? "transfer" : whaleType,
            amount: Math.max(Math.round(notional / 95000), 10),
            from,
            to,
            ts: Date.now(),
          };

          broadcast({ type: "whale", data: event });
          lastRealWhaleTs = Date.now();
          console.log(`[Whale] ${entry.sym} ${trade.qty.toFixed(2)} ($${(notional / 1000).toFixed(0)}k)`);
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on("error", (err: Error) =>
      console.error("[WhaleConnector] error:", err.message),
    );

    ws.on("close", () => {
      console.warn("[WhaleConnector] Disconnected, reconnecting in 8s...");
      setTimeout(connect, 8000);
    });
  }

  connect();
}
