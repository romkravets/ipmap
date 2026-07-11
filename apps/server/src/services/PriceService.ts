import type { PriceSnapshot, MarketMeta } from "@sessionmap/types";

const priceCache = new Map<string, { price: number; change24h: number }>();

const ZERO_PRICES = ["BTC", "ETH", "SOL", "BNB", "XRP"];
ZERO_PRICES.forEach((sym) => priceCache.set(sym, { price: 0, change24h: 0 }));

let metaCache: MarketMeta = {
  fearGreed: 50,
  btcDominance: 54.3,
  totalMarketCap: 2.38e12,
};

let onUpdateCallback: (() => void) | null = null;

export function getPriceSnapshot(): PriceSnapshot {
  const snapshot: PriceSnapshot = {};
  priceCache.forEach((v, k) => { snapshot[k] = v; });
  return snapshot;
}

export function setCachedPrice(sym: string, price: number, change24h: number) {
  priceCache.set(sym, { price, change24h });
}

export function getCachedMeta(): MarketMeta {
  return { ...metaCache };
}

export function setCachedMeta(meta: MarketMeta) {
  metaCache = { ...meta };
}

export function onPriceUpdate(cb: () => void) {
  onUpdateCallback = cb;
}

export function notifyPriceUpdate() {
  onUpdateCallback?.();
}

export const TRACKED = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
export const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: "BTC",
  ETHUSDT: "ETH",
  SOLUSDT: "SOL",
  BNBUSDT: "BNB",
  XRPUSDT: "XRP",
};
