import type { Exchange } from "@sessionmap/types";

// ── Traditional Stock Markets ─────────────────────────────────────────────────

export interface StockMarket {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  tz: string; // IANA timezone for open/close detection
  openLocal: number; // local decimal hour, e.g. 9.5 = 09:30
  closeLocal: number;
  lunchStart?: number; // TSE has a lunch break
  lunchEnd?: number;
  color: string;
}

export const STOCK_MARKETS: StockMarket[] = [
  {
    id: "nyse",
    name: "NYSE",
    city: "New York",
    lat: 40.707,
    lng: -74.011,
    tz: "America/New_York",
    openLocal: 9.5,
    closeLocal: 16.0,
    color: "#60a5fa",
  },
  {
    id: "nasdaq",
    name: "NASDAQ",
    city: "New York",
    lat: 40.76,
    lng: -73.985,
    tz: "America/New_York",
    openLocal: 9.5,
    closeLocal: 16.0,
    color: "#a78bfa",
  },
  {
    id: "lse",
    name: "LSE",
    city: "London",
    lat: 51.514,
    lng: -0.09,
    tz: "Europe/London",
    openLocal: 8.0,
    closeLocal: 16.5,
    color: "#fbbf24",
  },
  {
    id: "tse",
    name: "TSE",
    city: "Tokyo",
    lat: 35.681,
    lng: 139.767,
    tz: "Asia/Tokyo",
    openLocal: 9.0,
    closeLocal: 15.5,
    lunchStart: 11.5,
    lunchEnd: 12.5,
    color: "#f87171",
  },
  {
    id: "euronext",
    name: "Euronext",
    city: "Amsterdam",
    lat: 52.374,
    lng: 4.895,
    tz: "Europe/Amsterdam",
    openLocal: 9.0,
    closeLocal: 17.5,
    color: "#34d399",
  },
];

export function isStockMarketOpen(m: StockMarket, now: Date): boolean {
  // Weekday check in market's local timezone
  const dayName = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: m.tz,
  }).format(now);
  if (dayName === "Sat" || dayName === "Sun") return false;

  // Local decimal hour
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: m.tz,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const min = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const localH = h + min / 60;

  // Lunch break (TSE)
  if (
    m.lunchStart != null &&
    localH >= m.lunchStart &&
    localH < (m.lunchEnd ?? m.lunchStart + 1)
  )
    return false;

  return localH >= m.openLocal && localH < m.closeLocal;
}

export const EXCHANGES: Exchange[] = [
  {
    id: "binance",
    name: "Binance",
    city: "Singapore",
    lat: 1.35,
    lng: 103.82,
    vol: 76.4,
    share: 32,
    pairs: 1400,
    region: "asia",
    year: 2017,
  },
  {
    id: "okx",
    name: "OKX",
    city: "Hong Kong",
    lat: 22.3,
    lng: 114.17,
    vol: 28.1,
    share: 12,
    pairs: 680,
    region: "asia",
    year: 2017,
  },
  {
    id: "bybit",
    name: "Bybit",
    city: "Dubai",
    lat: 25.2,
    lng: 55.27,
    vol: 24.5,
    share: 10,
    pairs: 520,
    region: "asia",
    year: 2018,
  },
  {
    id: "coinbase",
    name: "Coinbase",
    city: "San Francisco",
    lat: 37.77,
    lng: -122.42,
    vol: 18.2,
    share: 8,
    pairs: 280,
    region: "americas",
    year: 2012,
  },
  {
    id: "htx",
    name: "HTX",
    city: "Singapore",
    lat: 1.28,
    lng: 103.86,
    vol: 14.3,
    share: 6,
    pairs: 760,
    region: "asia",
    year: 2013,
  },
  {
    id: "kucoin",
    name: "KuCoin",
    city: "Singapore",
    lat: 1.32,
    lng: 103.78,
    vol: 10.8,
    share: 5,
    pairs: 800,
    region: "asia",
    year: 2017,
  },
  {
    id: "deribit",
    name: "Deribit",
    city: "Amsterdam",
    lat: 52.37,
    lng: 4.9,
    vol: 9.6,
    share: 4,
    pairs: 120,
    region: "europe",
    year: 2016,
  },
  {
    id: "kraken",
    name: "Kraken",
    city: "San Francisco",
    lat: 37.8,
    lng: -122.45,
    vol: 8.4,
    share: 4,
    pairs: 240,
    region: "americas",
    year: 2011,
  },
  {
    id: "bitfinex",
    name: "Bitfinex",
    city: "London",
    lat: 51.5,
    lng: -0.12,
    vol: 7.1,
    share: 3,
    pairs: 190,
    region: "europe",
    year: 2012,
  },
  {
    id: "upbit",
    name: "Upbit",
    city: "Seoul",
    lat: 37.56,
    lng: 126.97,
    vol: 6.8,
    share: 3,
    pairs: 250,
    region: "asia",
    year: 2017,
  },
  {
    id: "gate",
    name: "Gate.io",
    city: "Singapore",
    lat: 1.29,
    lng: 103.85,
    vol: 6.2,
    share: 3,
    pairs: 1700,
    region: "asia",
    year: 2013,
  },
  {
    id: "mexc",
    name: "MEXC",
    city: "Singapore",
    lat: 1.31,
    lng: 103.88,
    vol: 5.5,
    share: 2,
    pairs: 2100,
    region: "asia",
    year: 2018,
  },
  {
    id: "bitmex",
    name: "BitMEX",
    city: "Hong Kong",
    lat: 22.28,
    lng: 114.15,
    vol: 4.8,
    share: 2,
    pairs: 60,
    region: "asia",
    year: 2014,
  },
  {
    id: "bithumb",
    name: "Bithumb",
    city: "Seoul",
    lat: 37.57,
    lng: 126.99,
    vol: 4.2,
    share: 2,
    pairs: 210,
    region: "asia",
    year: 2014,
  },
  {
    id: "gemini",
    name: "Gemini",
    city: "New York",
    lat: 40.71,
    lng: -74.0,
    vol: 3.5,
    share: 1,
    pairs: 120,
    region: "americas",
    year: 2014,
  },
  {
    id: "bitstamp",
    name: "Bitstamp",
    city: "Luxembourg",
    lat: 49.61,
    lng: 6.13,
    vol: 2.9,
    share: 1,
    pairs: 90,
    region: "europe",
    year: 2011,
  },
  {
    id: "phemex",
    name: "Phemex",
    city: "Singapore",
    lat: 1.34,
    lng: 103.8,
    vol: 2.4,
    share: 1,
    pairs: 320,
    region: "asia",
    year: 2019,
  },
  {
    id: "coincheck",
    name: "Coincheck",
    city: "Tokyo",
    lat: 35.68,
    lng: 139.69,
    vol: 2.1,
    share: 1,
    pairs: 30,
    region: "asia",
    year: 2012,
  },
  {
    id: "luno",
    name: "Luno",
    city: "London",
    lat: 51.51,
    lng: -0.09,
    vol: 1.2,
    share: 1,
    pairs: 20,
    region: "europe",
    year: 2013,
  },
  {
    id: "bittrex",
    name: "Bittrex",
    city: "Seattle",
    lat: 47.61,
    lng: -122.33,
    vol: 0.9,
    share: 0,
    pairs: 300,
    region: "americas",
    year: 2014,
  },
];

export const SESSION_TIMES: Record<string, { start: number; end: number }> = {
  asia: { start: 0, end: 9 },
  europe: { start: 7, end: 16 },
  americas: { start: 13, end: 22 },
};

export const SESSION_COLORS_CSS: Record<string, string> = {
  asia: "var(--session-asia)",
  europe: "var(--session-europe)",
  americas: "var(--session-americas)",
};

export const SESSION_COLORS_HEX: Record<string, string> = {
  asia: "#a78bfa",
  europe: "#34d399",
  americas: "#f472b6",
};

export const SESSION_LABELS: Record<string, string> = {
  asia: "Asia",
  europe: "Europe",
  americas: "Americas",
};

export const TWEAK_DEFAULTS = {
  rotationSpeed: 30,
  showTerminator: true,
  showSunMarker: true,
  markerPulse: true,
  timeOffset: 0,
};
