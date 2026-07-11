# SessionMap Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement seven improvements: server architecture refactor (PriceService + CoinGeckoConnector separation), real whale detection from Binance aggTrade stream, Fear & Greed live data via Alternative.me, `usePrices` hook extraction, texture preloading, RAF batching for price dispatch, and mobile-responsive layout.

**Architecture:** Server splits monolithic BinanceConnector into three focused modules; client extracts inline price logic into a dedicated hook; mobile layout adapts CleanUI and TerminalUI with CSS media queries.

**Tech Stack:** TypeScript, Node.js `ws`, Next.js 14, Three.js, React hooks, Tailwind CSS media queries, Alternative.me public API (no key required).

---

## File Map

### Server — new / changed
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/server/src/services/PriceService.ts` | **Create** | In-memory price cache, `getPriceSnapshot`, `getCachedMeta`, `onPriceUpdate` |
| `apps/server/src/connectors/BinanceConnector.ts` | **Rewrite** | Binance WS stream only; reads/writes via PriceService |
| `apps/server/src/connectors/CoinGeckoConnector.ts` | **Create** | CoinGecko REST polling + Alternative.me Fear & Greed polling |
| `apps/server/src/connectors/WhaleConnector.ts` | **Create** | Binance aggTrade streams; detects trades >$1M notional → WhaleEvent |
| `apps/server/src/services/WhaleService.ts` | **Modify** | Keep simulation fallback only (called when WhaleConnector has no events for >15s) |
| `apps/server/src/index.ts` | **Modify** | Wire new modules; remove old BinanceConnector exports |

### Client — new / changed
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/hooks/usePrices.ts` | **Create** | Simulated price nudge; extracted from AppContext |
| `apps/web/src/contexts/AppContext.tsx` | **Modify** | Remove inline price interval; call `usePrices` hook |
| `apps/web/src/hooks/useWebSocket.ts` | **Modify** | Batch price dispatch via `requestAnimationFrame` |
| `apps/web/src/app/layout.tsx` | **Modify** | Add `<link rel="preload">` for Earth day/night textures |
| `apps/web/src/components/globe/ExchangeLabels.tsx` | **Modify** | Wrap with `React.memo` if not already |
| `apps/web/src/app/globals.css` | **Modify** | Add mobile responsive breakpoints for CleanUI + TerminalUI |
| `apps/web/src/components/panels/CleanUI.tsx` | **Modify** | Add mobile CSS classes for stacked layout |
| `apps/web/src/components/panels/TerminalUI.tsx` | **Modify** | Add mobile CSS classes; collapse 3-column grid to 1-column |

---

## Task 1 — Create PriceService.ts

**Files:**
- Create: `apps/server/src/services/PriceService.ts`

- [ ] **Step 1: Create PriceService.ts**

```typescript
// apps/server/src/services/PriceService.ts
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
  return metaCache;
}

export function setCachedMeta(meta: MarketMeta) {
  metaCache = meta;
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/services/PriceService.ts
git commit -m "feat(server): add PriceService for isolated price cache"
```

---

## Task 2 — Rewrite BinanceConnector.ts (Binance-only)

**Files:**
- Modify: `apps/server/src/connectors/BinanceConnector.ts`

- [ ] **Step 1: Replace BinanceConnector.ts with Binance-only logic**

```typescript
// apps/server/src/connectors/BinanceConnector.ts
import {
  setCachedPrice,
  notifyPriceUpdate,
  TRACKED,
  SYMBOL_MAP,
} from "../services/PriceService.js";

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
  try {
    const symbols = TRACKED.map((s) => `"${s}"`).join(",");
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const tickers = (await res.json()) as BinanceRestTicker[];
    tickers.forEach((t) => {
      const sym = SYMBOL_MAP[t.symbol];
      if (!sym) return;
      setCachedPrice(sym, parseFloat(t.lastPrice), parseFloat(t.priceChangePercent));
    });
    console.log("[Binance] Bootstrapped prices via REST");
  } catch (err) {
    console.warn("[Binance] Bootstrap failed:", (err as Error).message);
  }
}

export function startBinanceConnector() {
  const WS = require("ws");
  const url =
    process.env.BINANCE_WS_URL ??
    "wss://stream.binance.com:9443/ws/!ticker@arr";

  function connect() {
    const ws = new WS(url);

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/connectors/BinanceConnector.ts
git commit -m "refactor(server): BinanceConnector delegates cache ops to PriceService"
```

---

## Task 3 — Create CoinGeckoConnector.ts with Fear & Greed

**Files:**
- Create: `apps/server/src/connectors/CoinGeckoConnector.ts`

- [ ] **Step 1: Create CoinGeckoConnector.ts**

Alternative.me Fear & Greed API: `https://api.alternative.me/fng/` — no key required, returns `{ data: [{ value: "62", value_classification: "Greed" }] }`.

```typescript
// apps/server/src/connectors/CoinGeckoConnector.ts
import type { MarketMeta } from "@sessionmap/types";
import { getCachedMeta, setCachedMeta } from "../services/PriceService.js";

const COINGECKO_URL =
  process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3";

interface FngResponse {
  data: Array<{ value: string; value_classification: string }>;
}

async function fetchFearGreed(): Promise<number | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as FngResponse;
    const val = parseInt(json.data[0]?.value ?? "", 10);
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

async function fetchGlobalMeta(): Promise<Partial<MarketMeta>> {
  try {
    const res = await fetch(`${COINGECKO_URL}/global`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      data: {
        market_cap_percentage: Record<string, number>;
        total_market_cap: Record<string, number>;
      };
    };
    return {
      btcDominance: json.data.market_cap_percentage?.["btc"] ?? undefined,
      totalMarketCap: json.data.total_market_cap?.["usd"] ?? undefined,
    };
  } catch {
    return {};
  }
}

export function startCoinGeckoPoller(onUpdate: (meta: MarketMeta) => void) {
  async function poll() {
    const [globalMeta, fearGreed] = await Promise.all([
      fetchGlobalMeta(),
      fetchFearGreed(),
    ]);

    const prev = getCachedMeta();
    const next: MarketMeta = {
      fearGreed: fearGreed ?? prev.fearGreed,
      btcDominance: globalMeta.btcDominance ?? prev.btcDominance,
      totalMarketCap: globalMeta.totalMarketCap ?? prev.totalMarketCap,
    };

    setCachedMeta(next);
    onUpdate(next);
    console.log(`[CoinGecko] F&G=${next.fearGreed} BTC.dom=${next.btcDominance.toFixed(1)}%`);
  }

  poll();
  // CoinGecko global: every 60s; F&G changes slowly but free tier allows frequent polling
  setInterval(poll, 60_000);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/connectors/CoinGeckoConnector.ts
git commit -m "feat(server): CoinGeckoConnector with live Fear & Greed from Alternative.me"
```

---

## Task 4 — Create WhaleConnector.ts (real Binance large trades)

Binance `btcusdt@aggTrade` stream emits every aggregated trade. Filter by `q` (quantity) > 5 BTC to surface real large trades as whale events.

**Files:**
- Create: `apps/server/src/connectors/WhaleConnector.ts`
- Modify: `apps/server/src/services/WhaleService.ts`

- [ ] **Step 1: Create WhaleConnector.ts**

```typescript
// apps/server/src/connectors/WhaleConnector.ts
import type { WhaleEvent } from "@sessionmap/types";
import { broadcast } from "../ws/broadcaster.js";

// Streams for top symbols — each emits per-trade data
const AGG_SYMBOLS = ["btcusdt", "ethusdt", "solusdt", "bnbusdt", "xrpusdt"];

// Notional thresholds for "whale" classification (USD)
const WHALE_THRESHOLD_USD = 1_000_000;

// Price cache from aggTrade stream to compute notional
const latestPrice: Record<string, number> = {
  btcusdt: 67000,
  ethusdt: 3400,
  solusdt: 155,
  bnbusdt: 610,
  xrpusdt: 0.52,
};

const SYMBOL_DISPLAY: Record<string, string> = {
  btcusdt: "BTC",
  ethusdt: "ETH",
  solusdt: "SOL",
  bnbusdt: "BNB",
  xrpusdt: "XRP",
};

// Exchange names for from/to — large trades routed to random known venues
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

// Track last real whale time for fallback logic
let lastRealWhaleTs = 0;
export function getLastRealWhaleTs() { return lastRealWhaleTs; }

interface AggTrade {
  s: string;  // symbol e.g. BTCUSDT
  p: string;  // price
  q: string;  // quantity
  m: boolean; // is buyer market maker (sell = true, buy = false)
}

export function startWhaleConnector() {
  const WS = require("ws");

  // Combined stream URL for all symbols
  const streams = AGG_SYMBOLS.map((s) => `${s}@aggTrade`).join("/");
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

  function connect() {
    const ws = new WS(url);

    ws.on("open", () => console.log("[WhaleConnector] Connected to aggTrade streams"));

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { data: AggTrade };
        const trade = msg.data;
        const sym = trade.s.toLowerCase();
        const price = parseFloat(trade.p);
        const qty = parseFloat(trade.q);

        // Keep price up to date
        latestPrice[sym] = price;

        const notional = price * qty;
        if (notional < WHALE_THRESHOLD_USD) return;

        const { from, to } = randomExchangePair();
        const whaleType = trade.m ? "withdraw" : "deposit"; // sell→withdraw, buy→deposit
        const amountDisplay = Math.round(
          sym === "btcusdt" ? qty : notional / (latestPrice["btcusdt"] || 67000)
        );

        const event: WhaleEvent = {
          id: `whale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: amountDisplay > 500 ? "transfer" : whaleType,
          amount: Math.max(amountDisplay, 10),
          from,
          to,
          ts: Date.now(),
        };

        lastRealWhaleTs = Date.now();
        broadcast({ type: "whale", data: event });
        console.log(`[Whale] Real: ${SYMBOL_DISPLAY[sym]} ${qty.toFixed(2)} ($${(notional / 1000).toFixed(0)}k)`);
      } catch {
        // ignore
      }
    });

    ws.on("error", (err: Error) =>
      console.error("[WhaleConnector] error:", err.message)
    );

    ws.on("close", () => {
      console.warn("[WhaleConnector] Disconnected, reconnecting in 8s...");
      setTimeout(connect, 8000);
    });
  }

  connect();
}
```

- [ ] **Step 2: Update WhaleService.ts to be a fallback-only simulator**

When no real whale event arrives in 15 seconds, the simulator fires once to keep the UI lively.

```typescript
// apps/server/src/services/WhaleService.ts
import type { WhaleEvent } from "@sessionmap/types";
import { broadcast } from "../ws/broadcaster.js";
import { getLastRealWhaleTs } from "../connectors/WhaleConnector.js";

const EXCHANGES = [
  "Binance", "OKX", "Bybit", "Coinbase", "HTX",
  "KuCoin", "Deribit", "Kraken", "Bitfinex", "Upbit",
  "Gate.io", "MEXC", "BitMEX", "Bithumb", "Gemini", "Bitstamp",
];
const EVENT_TYPES: WhaleEvent["type"][] = ["transfer", "deposit", "withdraw", "dex"];

function generateWhale(): WhaleEvent {
  const i1 = Math.floor(Math.random() * EXCHANGES.length);
  let i2 = Math.floor(Math.random() * (EXCHANGES.length - 1));
  if (i2 >= i1) i2++;
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
    amount: Math.floor(Math.random() * 4500 + 200),
    from: EXCHANGES[i1],
    to: EXCHANGES[i2],
    ts: Date.now(),
  };
}

const FALLBACK_SILENCE_MS = 15_000;

export function startWhaleService() {
  function maybeFire() {
    const silentMs = Date.now() - getLastRealWhaleTs();
    if (silentMs >= FALLBACK_SILENCE_MS) {
      broadcast({ type: "whale", data: generateWhale() });
    }
    setTimeout(maybeFire, (4 + Math.random() * 6) * 1000);
  }
  setTimeout(maybeFire, 5000);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/connectors/WhaleConnector.ts apps/server/src/services/WhaleService.ts
git commit -m "feat(server): real whale detection from Binance aggTrade; simulation as fallback"
```

---

## Task 5 — Update index.ts to wire all new modules

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Update index.ts**

```typescript
// apps/server/src/index.ts
import http from "http";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import { healthRouter } from "./routes/health.js";
import { createBroadcaster, broadcast } from "./ws/broadcaster.js";
import { bootstrapPrices, startBinanceConnector } from "./connectors/BinanceConnector.js";
import { startCoinGeckoPoller } from "./connectors/CoinGeckoConnector.js";
import { startWhaleConnector } from "./connectors/WhaleConnector.js";
import { startWhaleService } from "./services/WhaleService.js";
import { getPriceSnapshot, getCachedMeta, onPriceUpdate } from "./services/PriceService.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(helmet());
app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin === CLIENT_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", CLIENT_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use("/api", healthRouter);

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }, cb) => {
    cb(!origin || origin === CLIENT_ORIGIN, 403, "Forbidden origin");
  },
});

createBroadcaster(wss);

wss.on("connection", (ws) => {
  setImmediate(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "prices", data: getPriceSnapshot() }));
      ws.send(JSON.stringify({ type: "meta",   data: getCachedMeta() }));
    }
  });
});

onPriceUpdate(() => {
  broadcast({ type: "prices", data: getPriceSnapshot() });
});

bootstrapPrices().then(() => startBinanceConnector());

startCoinGeckoPoller((meta) => broadcast({ type: "meta", data: meta }));

startWhaleConnector();
startWhaleService();

server.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
  console.log(`[Server] WS on ws://localhost:${PORT}`);
  console.log(`[Server] Accepting connections from: ${CLIENT_ORIGIN}`);
});
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "refactor(server): wire PriceService, CoinGeckoConnector, WhaleConnector in index"
```

---

## Task 6 — Extract usePrices.ts hook (client)

**Files:**
- Create: `apps/web/src/hooks/usePrices.ts`
- Modify: `apps/web/src/contexts/AppContext.tsx`

- [ ] **Step 1: Create usePrices.ts**

```typescript
// apps/web/src/hooks/usePrices.ts
'use client'

import { useEffect, useRef } from 'react'
import type { PriceSnapshot } from '@sessionmap/types'
import type { Dispatch } from 'react'
import type { Action } from '@/contexts/reducer'

export function usePrices(prices: PriceSnapshot, dispatch: Dispatch<Action>) {
  const pricesRef = useRef<PriceSnapshot>(prices)
  pricesRef.current = prices

  useEffect(() => {
    const id = setInterval(() => {
      const entries = Object.entries(pricesRef.current)
      if (!entries.length) return
      const next: PriceSnapshot = {}
      entries.forEach(([sym, entry]) => {
        next[sym] = {
          price: Math.max(0.0001, entry.price + (Math.random() - 0.495) * entry.price * 0.0003),
          change24h: entry.change24h + (Math.random() - 0.5) * 0.02,
        }
      })
      dispatch({ type: 'PRICES_UPDATE', payload: next })
    }, 800)
    return () => clearInterval(id)
  }, [dispatch])
}
```

- [ ] **Step 2: Update AppContext.tsx — remove inline interval, call usePrices**

```typescript
// apps/web/src/contexts/AppContext.tsx
"use client";

import { createContext, useContext, useReducer, type Dispatch } from "react";
import type { AppState } from "@sessionmap/types";
import { reducer, initialState, type Action } from "./reducer";
import { usePrices } from "@/hooks/usePrices";

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  usePrices(state.prices, dispatch);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/usePrices.ts apps/web/src/contexts/AppContext.tsx
git commit -m "refactor(web): extract price simulation into usePrices hook"
```

---

## Task 7 — RAF batching in useWebSocket + React.memo on ExchangeLabels

**Files:**
- Modify: `apps/web/src/hooks/useWebSocket.ts`
- Modify: `apps/web/src/components/globe/ExchangeLabels.tsx` (add memo if missing)

- [ ] **Step 1: Add RAF batching to useWebSocket.ts**

Replace the direct `dispatch` calls for price updates with a RAF-batched version. Only prices need batching since they arrive at high frequency.

Read current `apps/web/src/hooks/useWebSocket.ts` then apply this change — replace the entire file with:

```typescript
// apps/web/src/hooks/useWebSocket.ts
'use client'

import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { useAppContext } from '@/contexts/AppContext'
import type { PriceSnapshot } from '@sessionmap/types'

const PriceEntrySchema = z.object({ price: z.number(), change24h: z.number() })
const PricesMessageSchema = z.object({
  type: z.literal('prices'),
  data: z.record(PriceEntrySchema),
})
const MetaMessageSchema = z.object({
  type: z.literal('meta'),
  data: z.object({
    fearGreed: z.number(),
    btcDominance: z.number(),
    totalMarketCap: z.number(),
  }),
})
const WhaleMessageSchema = z.object({
  type: z.literal('whale'),
  data: z.object({
    id: z.string(),
    type: z.enum(['transfer', 'deposit', 'withdraw', 'dex']),
    amount: z.number(),
    from: z.string(),
    to: z.string(),
    ts: z.number(),
  }),
})
const WsMessageSchema = z.union([PricesMessageSchema, MetaMessageSchema, WhaleMessageSchema])

export function useWebSocket() {
  const { dispatch } = useAppContext()
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1000)
  const mountedRef = useRef(true)
  // RAF batch: accumulate price updates, flush on next animation frame
  const pendingPricesRef = useRef<PriceSnapshot | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    const url = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000'

    function flushPrices() {
      rafRef.current = null
      if (pendingPricesRef.current) {
        dispatch({ type: 'PRICES_UPDATE', payload: pendingPricesRef.current })
        pendingPricesRef.current = null
      }
    }

    function schedulePriceFlush(snapshot: PriceSnapshot) {
      pendingPricesRef.current = snapshot
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushPrices)
      }
    }

    function connect() {
      if (!mountedRef.current) return
      dispatch({ type: 'SET_WS_STATUS', payload: 'connecting' })

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return }
        backoffRef.current = 1000
        dispatch({ type: 'SET_WS_STATUS', payload: 'connected' })
      }

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data as string)
          const parsed = WsMessageSchema.safeParse(raw)
          if (!parsed.success) return

          const msg = parsed.data
          if (msg.type === 'prices') {
            schedulePriceFlush(msg.data)
          } else if (msg.type === 'meta') {
            dispatch({ type: 'META_UPDATE', payload: msg.data })
          } else if (msg.type === 'whale') {
            dispatch({ type: 'WHALE_EVENT', payload: msg.data })
          }
        } catch {
          // ignore malformed
        }
      }

      ws.onerror = () => { /* onclose handles reconnect */ }

      ws.onclose = () => {
        if (!mountedRef.current) return
        dispatch({ type: 'SET_WS_STATUS', payload: 'disconnected' })
        const delay = backoffRef.current
        backoffRef.current = Math.min(backoffRef.current * 2, 30_000)
        setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      wsRef.current?.close()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [dispatch])
}
```

- [ ] **Step 2: Read ExchangeLabels.tsx and add memo if not present**

Read `apps/web/src/components/globe/ExchangeLabels.tsx`. If the component is not already wrapped with `memo`, wrap the export. The file should export `export const ExchangeLabels = memo(function ExchangeLabels(...) { ... })`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useWebSocket.ts apps/web/src/components/globe/ExchangeLabels.tsx
git commit -m "perf(web): RAF-batch price dispatch in useWebSocket; memo on ExchangeLabels"
```

---

## Task 8 — Texture preload in layout.tsx

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

The texture URLs used in `useGlobe.ts` are:
- Day: `https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg`
- Night: `https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg`

- [ ] **Step 1: Add preload links to layout.tsx**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'SessionMap — Crypto Trading Sessions',
  description: 'Visualise global crypto trading sessions on a real-time 3D globe with live prices and whale movements.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}>
      <head>
        <link
          rel="preload"
          as="image"
          href="https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="image"
          href="https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans mode-transition" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "perf(web): preload Earth day/night textures in <head>"
```

---

## Task 9 — Mobile responsive layout

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/panels/CleanUI.tsx`
- Modify: `apps/web/src/components/panels/TerminalUI.tsx`

Strategy:
- **CleanUI** (≤768px): reduce padding, shrink font sizes, move prices to a horizontal scroll strip instead of vertical column, hide whale ticker on very small screens
- **TerminalUI** (≤768px): collapse 3-column grid to single-column; left panel becomes collapsible, right panel scrolls at bottom
- Globe canvas always full-screen (already is)

- [ ] **Step 1: Add CSS custom properties + mobile helpers to globals.css**

Read `apps/web/src/app/globals.css` first, then add at the end:

```css
/* ── Mobile responsive ───────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .clean-ui-wrap {
    padding: 12px 14px !important;
  }
  .clean-ui-topbar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .clean-ui-bottom {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start !important;
  }
  .clean-ui-prices {
    flex-direction: row !important;
    flex-wrap: wrap;
    gap: 10px 18px;
    align-items: center;
  }
  .clean-ui-whale-ticker {
    display: none;
  }
  /* Terminal */
  .terminal-grid {
    grid-template-columns: 1fr !important;
  }
  .terminal-left-panel {
    max-height: 180px;
    border-right: none !important;
    border-bottom: 1px solid rgba(0,255,159,0.08);
  }
  .terminal-right-panel {
    border-left: none !important;
    border-top: 1px solid rgba(0,255,159,0.08);
    max-height: 220px;
  }
  .terminal-center-void {
    display: none;
  }
  .terminal-bottom-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
  }
  .terminal-bottom-bar > div {
    min-width: 80px;
  }
}
```

- [ ] **Step 2: Add className hooks to CleanUI.tsx**

The component uses inline styles. Add `className` props to the key elements so the CSS media queries above can target them. Apply the following changes:

Outer wrapper div → add `className="clean-ui-wrap"`, keep existing style prop.
Top bar div → add `className="clean-ui-topbar"`, keep style.
Bottom row div → add `className="clean-ui-bottom"`, keep style.
Price ticker column div → add `className="clean-ui-prices"`, keep style.
`<WhaleTicker>` wrapper → wrap in `<div className="clean-ui-whale-ticker">`.

Minimal diff for CleanUI.tsx — the outer `<div>`:
```tsx
<div
  className="clean-ui-wrap"
  style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    padding: '20px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  }}
>
```

Top bar `<div>` with `justifyContent: 'space-between'`:
```tsx
<div className="clean-ui-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
```

Whale ticker section:
```tsx
<div className="clean-ui-whale-ticker">
  <WhaleTicker events={whaleEvents} />
</div>
```

Bottom row `<div>`:
```tsx
<div className="clean-ui-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
```

Price ticker column `<div>` (right side):
```tsx
<div className="clean-ui-prices" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
```

- [ ] **Step 3: Add className hooks to TerminalUI.tsx**

Main grid div (3-column):
```tsx
<div
  className="terminal-grid"
  style={{
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '220px 1fr 220px',
    overflow: 'hidden',
  }}
>
```

Left panel outer div:
```tsx
<div className="terminal-left-panel" style={{ ...sidePanel, borderRight: '1px solid rgba(0,255,159,0.08)' }}>
```

Center void div:
```tsx
<div className="terminal-center-void" />
```

Right panel outer div:
```tsx
<div className="terminal-right-panel" style={{ ...sidePanel, borderLeft: '1px solid rgba(0,255,159,0.08)' }}>
```

Bottom price bar div:
```tsx
<div
  className="terminal-bottom-bar"
  style={{
    borderTop: '1px solid rgba(0,255,159,0.10)',
    background: 'rgba(0,0,0,0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex',
    flexShrink: 0,
  }}
>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/panels/CleanUI.tsx apps/web/src/components/panels/TerminalUI.tsx
git commit -m "feat(web): mobile responsive layout for CleanUI and TerminalUI"
```

---

## Self-Review

**Spec coverage:**
- ✅ PriceService.ts as separate file — Task 1
- ✅ CoinGeckoConnector.ts as separate file — Task 3
- ✅ Live Fear & Greed via Alternative.me — Task 3
- ✅ Real whale data from Binance aggTrade — Task 4
- ✅ Simulation as fallback — Task 4
- ✅ usePrices.ts hook extracted — Task 6
- ✅ RAF batching for price dispatch — Task 7
- ✅ React.memo on ExchangeLabels — Task 7
- ✅ `<link rel="preload">` for textures — Task 8
- ✅ Mobile layout — Task 9

**Placeholder scan:** No TBD/TODO in any code block. All function signatures consistent across tasks. PriceService exports used in BinanceConnector (Task 2) and index.ts (Task 5) match what Task 1 defines. `getLastRealWhaleTs` exported from WhaleConnector, imported in WhaleService — consistent.

**Type consistency:** `WhaleEvent` type imported from `@sessionmap/types` in WhaleConnector — consistent with existing types. `MarketMeta` shape matches existing `packages/types/src/index.ts`.
