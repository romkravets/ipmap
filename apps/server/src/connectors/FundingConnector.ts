import { broadcast } from "../ws/broadcaster.js";
import type { FundingRateMap } from "@sessionmap/types";

// Kraken Futures perpetual symbols → internal symbol
const KRAKEN_MAP: Record<string, string> = {
  PF_XBTUSD: "BTC",
  PF_ETHUSD: "ETH",
  PF_SOLUSD: "SOL",
  PF_XRPUSD: "XRP",
};

interface KrakenFuturesTicker {
  symbol: string;
  tag: string;
  fundingRate?: number;
}

interface KrakenFuturesResponse {
  result: string;
  tickers: KrakenFuturesTicker[];
}

async function fetchFundingRates(): Promise<FundingRateMap | null> {
  try {
    const res = await fetch(
      "https://futures.kraken.com/derivatives/api/v3/tickers",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as KrakenFuturesResponse;
    if (json.result !== "success") return null;

    const rates: FundingRateMap = {};
    for (const ticker of json.tickers) {
      const sym = KRAKEN_MAP[ticker.symbol];
      if (!sym || ticker.tag !== "perpetual" || ticker.fundingRate == null) continue;
      rates[sym] = ticker.fundingRate;
    }
    return Object.keys(rates).length ? rates : null;
  } catch {
    return null;
  }
}

export function startFundingConnector() {
  async function poll() {
    const rates = await fetchFundingRates();
    if (!rates) return;
    broadcast({ type: "funding", data: rates });
    const btcRate = rates["BTC"];
    if (btcRate !== undefined) {
      console.log(`[Funding] BTC=${(btcRate * 100).toFixed(4)}%`);
    }
  }

  poll();
  setInterval(poll, 30_000);
}
