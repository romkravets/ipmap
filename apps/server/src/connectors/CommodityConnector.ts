/**
 * Commodity price poller — Gold (XAU/USD), Oil (WTI), Natural Gas
 * Uses Yahoo Finance v7 API (same endpoint as yahoo-finance.ts in web)
 * Polls every 5 minutes (commodity prices don't need sub-minute updates)
 */
import { broadcast } from '../ws/broadcaster.js';

interface CommodityData {
  gold:  { price: number; change: number; changePercent: number } | null;
  oil:   { price: number; change: number; changePercent: number } | null;
  gas:   { price: number; change: number; changePercent: number } | null;
  ts: number;
}

let cached: CommodityData = { gold: null, oil: null, gas: null, ts: 0 };

const SYMBOLS = {
  gold: 'GC=F',   // Gold Futures
  oil:  'CL=F',   // WTI Crude Oil Futures
  gas:  'NG=F',   // Natural Gas Futures
};

async function fetchQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    // v8 chart endpoint works reliably for futures symbols (GC=F, CL=F, NG=F)
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: { result?: Array<{ meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
      } }> }
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.previousClose ?? price;
    const change = price - prev;
    return {
      price,
      change,
      changePercent: prev !== 0 ? (change / prev) * 100 : 0,
    };
  } catch {
    return null;
  }
}

async function poll() {
  const [gold, oil, gas] = await Promise.all([
    fetchQuote(SYMBOLS.gold),
    fetchQuote(SYMBOLS.oil),
    fetchQuote(SYMBOLS.gas),
  ]);

  cached = { gold, oil, gas, ts: Date.now() };

  broadcast({ type: 'commodities', data: cached });
  console.log('[Commodity] Gold:', gold?.price?.toFixed(2), '| Oil:', oil?.price?.toFixed(2), '| Gas:', gas?.price?.toFixed(2));
}

export function startCommodityConnector() {
  poll().catch(console.error);
  setInterval(() => poll().catch(console.error), 5 * 60 * 1000); // every 5 min
}

export function getCachedCommodities(): CommodityData {
  return cached;
}
