import WebSocket from "ws";
import {
  setCachedPrice,
  notifyPriceUpdate,
  TRACKED,
  SYMBOL_MAP,
} from "../services/PriceService.js";
import { fetchCoinGeckoPrices } from "./CoinGeckoConnector.js";

interface BinanceTicker {
  s: string;
  c: string;
  P: string;
}

interface BinanceRestTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

export async function bootstrapPrices(): Promise<void> {
  // Try Binance first; fall back to CoinGecko if blocked (e.g. EU geo-block)
  try {
    const symbols = TRACKED.map((s) => `"${s}"`).join(",");
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const tickers = (await res.json()) as BinanceRestTicker[];
      tickers.forEach((t) => {
        const sym = SYMBOL_MAP[t.symbol];
        if (!sym) return;
        setCachedPrice(sym, parseFloat(t.lastPrice), parseFloat(t.priceChangePercent));
      });
      console.log("[Binance] Bootstrapped prices via REST");
      return;
    }
    console.warn("[Binance] REST returned", res.status, "— trying CoinGecko");
  } catch (err) {
    console.warn("[Binance] Bootstrap failed:", (err as Error).message, "— trying CoinGecko");
  }
  await fetchCoinGeckoPrices();
}

export function startBinanceConnector() {
  const url =
    process.env.BINANCE_WS_URL ??
    "wss://stream.binance.com:9443/ws/!ticker@arr";

  function connect() {
    const ws = new WebSocket(url);

    ws.on("open", () => console.log("[Binance] Connected to", url));

    ws.on("message", (raw: Buffer) => {
      try {
        const tickers: BinanceTicker[] = JSON.parse(raw.toString());
        let changed = false;
        tickers.forEach((t) => {
          const sym = SYMBOL_MAP[t.s];
          if (!sym) return;
          setCachedPrice(sym, parseFloat(t.c), parseFloat(t.P));
          changed = true;
        });
        if (changed) notifyPriceUpdate();
      } catch {
        // ignore malformed
      }
    });

    ws.on("error", (err: Error) =>
      console.error("[Binance] WS error:", err.message)
    );

    ws.on("close", () => {
      console.warn("[Binance] Disconnected, reconnecting in 5s...");
      setTimeout(connect, 5000);
    });
  }

  connect();
}
