import WebSocket from "ws";
import { setCachedPrice, notifyPriceUpdate } from "../services/PriceService.js";

// Kraken WebSocket v2 symbol → internal symbol
const SYMBOL_MAP: Record<string, string> = {
  "BTC/USD": "BTC",
  "ETH/USD": "ETH",
  "SOL/USD": "SOL",
  "XRP/USD": "XRP",
};

// Kraken REST pair key → internal symbol (Kraken uses legacy pair names in REST)
const REST_MAP: Record<string, string> = {
  XXBTZUSD: "BTC",
  XETHZUSD: "ETH",
  SOLUSD: "SOL",
  XXRPZUSD: "XRP",
};

const PAIRS = Object.keys(SYMBOL_MAP);

interface KrakenTickerData {
  symbol: string;
  last: number;
  change: number;
  change_pct: number;
}

interface KrakenMsg {
  channel: string;
  type: string;
  data: KrakenTickerData[];
}

export async function bootstrapFromKraken(): Promise<boolean> {
  try {
    const res = await fetch(
      "https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD,XRPUSD",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as {
      error: string[];
      result: Record<string, { c: [string, string]; P: [string, string] }>;
    };
    if (json.error?.length) return false;
    let updated = false;
    for (const [pair, data] of Object.entries(json.result)) {
      const sym = REST_MAP[pair];
      if (!sym) continue;
      setCachedPrice(sym, parseFloat(data.c[0]), parseFloat(data.P[1]));
      updated = true;
    }
    if (updated) console.log("[Kraken] Bootstrapped prices via REST");
    return updated;
  } catch (err) {
    console.warn("[Kraken] Bootstrap failed:", (err as Error).message);
    return false;
  }
}

export function startKrakenConnector() {
  function connect() {
    const ws = new WebSocket("wss://ws.kraken.com/v2");

    ws.on("open", () => {
      console.log("[Kraken] Connected");
      ws.send(
        JSON.stringify({
          method: "subscribe",
          params: { channel: "ticker", symbol: PAIRS },
        }),
      );
    });

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as KrakenMsg;
        if (msg.channel !== "ticker" || !Array.isArray(msg.data)) return;
        let changed = false;
        for (const d of msg.data) {
          const sym = SYMBOL_MAP[d.symbol];
          if (!sym || !d.last) continue;
          setCachedPrice(sym, d.last, d.change_pct ?? 0);
          changed = true;
        }
        if (changed) notifyPriceUpdate();
      } catch {
        // ignore malformed frames
      }
    });

    ws.on("error", (err: Error) =>
      console.error("[Kraken] WS error:", err.message),
    );

    ws.on("close", () => {
      console.warn("[Kraken] Disconnected, reconnecting in 5s...");
      setTimeout(connect, 5000);
    });
  }

  connect();
}
