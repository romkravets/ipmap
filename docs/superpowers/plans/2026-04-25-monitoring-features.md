# Monitoring Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 9 new monitoring features: liquidations feed, funding rates, ETH gas, price sparklines, session volume bars, live exchange data, altcoin season index, price alerts, and heatmap globe mode.

**Architecture:** Server gains three new connectors (LiquidationsConnector, FundingConnector, EthGasConnector) that stream new WsMessage types to the client. The client extends AppState with `liquidations`, `fundingRates`, `ethGas`; adds pure-client hooks for sparklines (`useSparklines`), live exchanges (`useLiveExchanges`), price alerts (`usePriceAlerts`); and integrates all UI into TerminalUI/CleanUI. Heatmap is a new `GlobeMode` that re-colors exchange markers by volume intensity.

**Tech Stack:** Node.js ws, Binance futures WebSocket (wss://fstream.binance.com), Binance REST (fapi.binance.com), Etherscan Gas Oracle REST, CoinGecko REST (client-side), Web Notifications API, React SVG, localStorage.

---

## File Structure

**New files:**
- `apps/server/src/connectors/LiquidationsConnector.ts` — Binance futures `!forceOrder@arr` stream
- `apps/server/src/connectors/FundingConnector.ts` — poll Binance `/fapi/v1/premiumIndex` every 30s
- `apps/server/src/connectors/EthGasConnector.ts` — poll Etherscan gas oracle every 60s
- `apps/web/src/hooks/useSparklines.ts` — accumulate last 100 prices per symbol, batch re-render every 5s
- `apps/web/src/hooks/useLiveExchanges.ts` — fetch CoinGecko /exchanges every 5min client-side
- `apps/web/src/hooks/usePriceAlerts.ts` — localStorage alerts + Web Notifications
- `apps/web/src/lib/altcoin-season.ts` — pure function computing altcoin season score from PriceSnapshot
- `apps/web/src/components/panels/PriceSparklines.tsx` — SVG polyline mini-charts
- `apps/web/src/components/panels/SessionVolumeBars.tsx` — horizontal region volume bars
- `apps/web/src/components/panels/AltcoinSeasonBadge.tsx` — score badge with label
- `apps/web/src/components/panels/PriceAlertsPanel.tsx` — add/view/delete price alert rules

**Modified files:**
- `packages/types/src/index.ts` — add `LiquidationEvent`, `FundingRateMap`, `EthGas`; extend `WsMessage`, `AppState`, `GlobeMode`
- `apps/server/src/index.ts` — wire three new connectors
- `apps/web/src/contexts/reducer.ts` — add `LIQUIDATION_EVENT`, `FUNDING_UPDATE`, `GAS_UPDATE` actions
- `apps/web/src/hooks/useWebSocket.ts` — Zod schemas + dispatch for 3 new message types
- `apps/web/src/components/panels/GlobeModeBar.tsx` — add `heatmap` button
- `apps/web/src/components/globe/ExchangeLabels.tsx` — accept `globeMode` prop, heat-color dots
- `apps/web/src/components/panels/TerminalUI.tsx` — add liquidations, funding, gas, sparklines, volume bars, altcoin season
- `apps/web/src/components/panels/CleanUI.tsx` — add volume bars, altcoin season badge, gas widget, alerts button
- `apps/web/src/app/(dashboard)/page.tsx` — wire all new hooks and props

---

### Task 1: Extend shared types + AppState + reducer

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `apps/web/src/contexts/reducer.ts`

- [ ] **Step 1: Extend `packages/types/src/index.ts`**

Replace the existing file with this content (keep everything that is already there, add the new parts):

```typescript
// ── WS Message Types ─────────────────────────────────────────────────────────

export type WsMessage =
  | { type: "prices"; data: PriceSnapshot }
  | { type: "meta"; data: MarketMeta }
  | { type: "whale"; data: WhaleEvent }
  | { type: "liquidation"; data: LiquidationEvent }
  | { type: "funding"; data: FundingRateMap }
  | { type: "gas"; data: EthGas };

export type PriceSnapshot = Record<
  string,
  { price: number; change24h: number }
>;

export interface MarketMeta {
  fearGreed: number;
  btcDominance: number;
  totalMarketCap: number;
}

export interface WhaleEvent {
  id: string;
  type: "transfer" | "deposit" | "withdraw" | "dex";
  amount: number;
  from: string;
  to: string;
  ts: number;
}

export interface LiquidationEvent {
  id: string;
  symbol: string;   // "BTC", "ETH", etc.
  side: "LONG" | "SHORT";
  qty: number;
  price: number;
  usdValue: number;
  ts: number;
}

export type FundingRateMap = Record<string, number>;

export interface EthGas {
  slow: number;
  standard: number;
  fast: number;
}

// ── Exchange / Globe Types ────────────────────────────────────────────────────

export type SessionRegion = "asia" | "europe" | "americas";

export interface Exchange {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  vol: number;
  share: number;
  pairs: number;
  region: SessionRegion;
  year: number;
}

// ── Session Types ─────────────────────────────────────────────────────────────

export interface SessionEvent {
  type: "open" | "close";
  session: SessionRegion;
  hours: number;
}

export type VolatilityLevel = "low" | "medium" | "high";

export interface SessionInfo {
  active: SessionRegion[];
  nextEvent: SessionEvent | null;
  volatility: VolatilityLevel;
  utcH: number;
}

// ── App State ─────────────────────────────────────────────────────────────────

export type GlobeMode = "auto" | "free" | "follow" | "heatmap";
export type WsStatus = "connecting" | "connected" | "disconnected";

export interface TweakValues {
  rotationSpeed: number;
  showTerminator: boolean;
  showSunMarker: boolean;
  markerPulse: boolean;
  timeOffset: number;
}

export interface AppState {
  prices: PriceSnapshot;
  marketMeta: MarketMeta | null;
  whaleEvents: WhaleEvent[];
  liquidations: LiquidationEvent[];
  fundingRates: FundingRateMap;
  ethGas: EthGas | null;
  globeMode: GlobeMode;
  terminalMode: boolean;
  tweaks: TweakValues;
  wsStatus: WsStatus;
}
```

- [ ] **Step 2: Update `apps/web/src/contexts/reducer.ts`**

```typescript
import type { AppState, PriceSnapshot, MarketMeta, WhaleEvent, LiquidationEvent, FundingRateMap, EthGas, GlobeMode, TweakValues } from '@sessionmap/types'
import { TWEAK_DEFAULTS } from '@/lib/constants'

export type Action =
  | { type: 'PRICES_UPDATE'; payload: PriceSnapshot }
  | { type: 'META_UPDATE'; payload: MarketMeta }
  | { type: 'WHALE_EVENT'; payload: WhaleEvent }
  | { type: 'LIQUIDATION_EVENT'; payload: LiquidationEvent }
  | { type: 'FUNDING_UPDATE'; payload: FundingRateMap }
  | { type: 'GAS_UPDATE'; payload: EthGas }
  | { type: 'SET_GLOBE_MODE'; payload: GlobeMode }
  | { type: 'TOGGLE_TERMINAL' }
  | { type: 'SET_TWEAK'; payload: Partial<TweakValues> }
  | { type: 'SET_WS_STATUS'; payload: AppState['wsStatus'] }

export const initialState: AppState = {
  prices: {
    BTC: { price: 67234, change24h: 0.42 },
    ETH: { price: 3412,  change24h: -0.18 },
    SOL: { price: 156,   change24h: 1.23 },
    BNB: { price: 612,   change24h: 0.05 },
    XRP: { price: 0.524, change24h: -0.33 },
  },
  marketMeta: null,
  whaleEvents: [],
  liquidations: [],
  fundingRates: {},
  ethGas: null,
  globeMode: 'auto',
  terminalMode: false,
  tweaks: TWEAK_DEFAULTS,
  wsStatus: 'connecting',
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'PRICES_UPDATE':
      return { ...state, prices: action.payload }

    case 'META_UPDATE':
      return { ...state, marketMeta: action.payload }

    case 'WHALE_EVENT':
      return {
        ...state,
        whaleEvents: [action.payload, ...state.whaleEvents].slice(0, 30),
      }

    case 'LIQUIDATION_EVENT':
      return {
        ...state,
        liquidations: [action.payload, ...state.liquidations].slice(0, 30),
      }

    case 'FUNDING_UPDATE':
      return { ...state, fundingRates: action.payload }

    case 'GAS_UPDATE':
      return { ...state, ethGas: action.payload }

    case 'SET_GLOBE_MODE':
      return { ...state, globeMode: action.payload }

    case 'TOGGLE_TERMINAL':
      return { ...state, terminalMode: !state.terminalMode }

    case 'SET_TWEAK':
      return { ...state, tweaks: { ...state.tweaks, ...action.payload } }

    case 'SET_WS_STATUS':
      return { ...state, wsStatus: action.payload }

    default:
      return state
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd /path/to/sessionmap
pnpm type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts apps/web/src/contexts/reducer.ts
git commit -m "feat: extend shared types and reducer for liquidations, funding, gas, heatmap mode"
```

---

### Task 2: LiquidationsConnector (server)

**Files:**
- Create: `apps/server/src/connectors/LiquidationsConnector.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create `apps/server/src/connectors/LiquidationsConnector.ts`**

```typescript
import WebSocket from "ws";
import { broadcast } from "../ws/broadcaster.js";
import type { LiquidationEvent } from "@sessionmap/types";

const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL",
  BNBUSDT: "BNB", XRPUSDT: "XRP",
};
const USD_THRESHOLD = 100_000;

let ws: WebSocket | null = null;

export function startLiquidationsConnector() {
  connect();
}

function connect() {
  ws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");

  ws.on("open", () => {
    console.log("[Liquidations] Connected to Binance futures liquidations stream");
  });

  ws.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        data?: {
          e: string;
          o: {
            s: string;
            S: "BUY" | "SELL";
            ap: string;
            l: string;
            T: number;
          };
        };
      };
      const order = msg.data?.o;
      if (!order) return;

      const sym = SYMBOL_MAP[order.s];
      if (!sym) return;

      const price = parseFloat(order.ap);
      const qty = parseFloat(order.l);
      const usdValue = price * qty;
      if (usdValue < USD_THRESHOLD) return;

      const event: LiquidationEvent = {
        id: `liq-${order.T}-${order.s}`,
        symbol: sym,
        // BUY side = short position liquidated (forced to buy back)
        // SELL side = long position liquidated (forced to sell)
        side: order.S === "BUY" ? "SHORT" : "LONG",
        qty,
        price,
        usdValue,
        ts: order.T,
      };

      broadcast({ type: "liquidation", data: event });
      console.log(`[Liquidations] ${sym} ${event.side} $${(usdValue / 1000).toFixed(0)}K`);
    } catch {
      // ignore malformed
    }
  });

  ws.on("close", () => {
    console.log("[Liquidations] Disconnected, reconnecting in 5s…");
    setTimeout(connect, 5_000);
  });

  ws.on("error", (err) => {
    console.error("[Liquidations] WS error:", err.message);
  });
}
```

- [ ] **Step 2: Wire into `apps/server/src/index.ts`**

Add at the top with other imports:
```typescript
import { startLiquidationsConnector } from "./connectors/LiquidationsConnector.js";
```

Add after `startWhaleService()`:
```typescript
startLiquidationsConnector();
```

- [ ] **Step 3: Type-check server**

```bash
pnpm --filter @sessionmap/server type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/connectors/LiquidationsConnector.ts apps/server/src/index.ts
git commit -m "feat: add LiquidationsConnector streaming Binance futures force orders"
```

---

### Task 3: FundingConnector (server)

**Files:**
- Create: `apps/server/src/connectors/FundingConnector.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create `apps/server/src/connectors/FundingConnector.ts`**

```typescript
import { broadcast } from "../ws/broadcaster.js";
import type { FundingRateMap } from "@sessionmap/types";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL",
  BNBUSDT: "BNB", XRPUSDT: "XRP",
};
const BASE_URL = "https://fapi.binance.com";

interface PremiumIndexEntry {
  symbol: string;
  lastFundingRate: string;
}

async function fetchFundingRates(): Promise<FundingRateMap | null> {
  try {
    const res = await fetch(`${BASE_URL}/fapi/v1/premiumIndex`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PremiumIndexEntry[];
    const rates: FundingRateMap = {};
    for (const entry of data) {
      const sym = SYMBOL_MAP[entry.symbol];
      if (sym && SYMBOLS.includes(entry.symbol)) {
        rates[sym] = parseFloat(entry.lastFundingRate);
      }
    }
    return rates;
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
```

- [ ] **Step 2: Wire into `apps/server/src/index.ts`**

Add import:
```typescript
import { startFundingConnector } from "./connectors/FundingConnector.js";
```

Add after `startLiquidationsConnector()`:
```typescript
startFundingConnector();
```

- [ ] **Step 3: Type-check server**

```bash
pnpm --filter @sessionmap/server type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/connectors/FundingConnector.ts apps/server/src/index.ts
git commit -m "feat: add FundingConnector polling Binance futures premiumIndex every 30s"
```

---

### Task 4: EthGasConnector (server)

**Files:**
- Create: `apps/server/src/connectors/EthGasConnector.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create `apps/server/src/connectors/EthGasConnector.ts`**

```typescript
import { broadcast } from "../ws/broadcaster.js";
import type { EthGas } from "@sessionmap/types";

const API_KEY = process.env.ETHERSCAN_API_KEY ?? "";
const URL = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${API_KEY}`;

interface EtherscanGasResponse {
  status: string;
  result: {
    SafeGasPrice: string;
    ProposeGasPrice: string;
    FastGasPrice: string;
  };
}

async function fetchGas(): Promise<EthGas | null> {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as EtherscanGasResponse;
    if (json.status !== "1") return null;
    return {
      slow: parseInt(json.result.SafeGasPrice, 10),
      standard: parseInt(json.result.ProposeGasPrice, 10),
      fast: parseInt(json.result.FastGasPrice, 10),
    };
  } catch {
    return null;
  }
}

export function startEthGasConnector() {
  async function poll() {
    const gas = await fetchGas();
    if (!gas) return;
    broadcast({ type: "gas", data: gas });
    console.log(`[EthGas] slow=${gas.slow} std=${gas.standard} fast=${gas.fast} gwei`);
  }

  poll();
  setInterval(poll, 60_000);
}
```

- [ ] **Step 2: Wire into `apps/server/src/index.ts`**

Add import:
```typescript
import { startEthGasConnector } from "./connectors/EthGasConnector.js";
```

Add after `startFundingConnector()`:
```typescript
startEthGasConnector();
```

- [ ] **Step 3: Type-check server**

```bash
pnpm --filter @sessionmap/server type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/connectors/EthGasConnector.ts apps/server/src/index.ts
git commit -m "feat: add EthGasConnector polling Etherscan gas oracle every 60s"
```

---

### Task 5: Extend useWebSocket to handle new message types

**Files:**
- Modify: `apps/web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Update `apps/web/src/hooks/useWebSocket.ts`**

```typescript
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
const LiquidationMessageSchema = z.object({
  type: z.literal('liquidation'),
  data: z.object({
    id: z.string(),
    symbol: z.string(),
    side: z.enum(['LONG', 'SHORT']),
    qty: z.number(),
    price: z.number(),
    usdValue: z.number(),
    ts: z.number(),
  }),
})
const FundingMessageSchema = z.object({
  type: z.literal('funding'),
  data: z.record(z.number()),
})
const GasMessageSchema = z.object({
  type: z.literal('gas'),
  data: z.object({
    slow: z.number(),
    standard: z.number(),
    fast: z.number(),
  }),
})
const WsMessageSchema = z.union([
  PricesMessageSchema,
  MetaMessageSchema,
  WhaleMessageSchema,
  LiquidationMessageSchema,
  FundingMessageSchema,
  GasMessageSchema,
])

export function useWebSocket() {
  const { dispatch } = useAppContext()
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1000)
  const mountedRef = useRef(true)
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
          } else if (msg.type === 'liquidation') {
            dispatch({ type: 'LIQUIDATION_EVENT', payload: msg.data })
          } else if (msg.type === 'funding') {
            dispatch({ type: 'FUNDING_UPDATE', payload: msg.data })
          } else if (msg.type === 'gas') {
            dispatch({ type: 'GAS_UPDATE', payload: msg.data })
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

- [ ] **Step 2: Type-check web**

```bash
pnpm --filter @sessionmap/web type-check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useWebSocket.ts
git commit -m "feat: extend useWebSocket to handle liquidation, funding, gas messages"
```

---

### Task 6: useSparklines hook + PriceSparklines component

**Files:**
- Create: `apps/web/src/hooks/useSparklines.ts`
- Create: `apps/web/src/components/panels/PriceSparklines.tsx`

- [ ] **Step 1: Create `apps/web/src/hooks/useSparklines.ts`**

The hook accumulates price history in a `useRef` (no re-render on every tick) and exposes a snapshot every 5 seconds.

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import type { PriceSnapshot } from '@sessionmap/types'

const MAX_POINTS = 100

export function useSparklines(prices: PriceSnapshot): Map<string, number[]> {
  const historyRef = useRef<Map<string, number[]>>(new Map())
  const [, setTick] = useState(0)

  // Accumulate on every prices change (no re-render here)
  useEffect(() => {
    for (const [sym, entry] of Object.entries(prices)) {
      const arr = historyRef.current.get(sym) ?? []
      arr.push(entry.price)
      if (arr.length > MAX_POINTS) arr.shift()
      historyRef.current.set(sym, arr)
    }
  }, [prices])

  // Trigger re-render every 5s so sparklines visually update
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  return historyRef.current
}
```

- [ ] **Step 2: Create `apps/web/src/components/panels/PriceSparklines.tsx`**

```typescript
'use client'

import { memo } from 'react'

interface PriceSparklinesProps {
  symbol: string
  history: number[]
  width?: number
  height?: number
  color?: string
}

function buildPolyline(points: number[], w: number, h: number): string {
  if (points.length < 2) return ''
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / range) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export const PriceSparklines = memo(function PriceSparklines({
  symbol,
  history,
  width = 80,
  height = 24,
  color = 'var(--accent)',
}: PriceSparklinesProps) {
  const points = buildPolyline(history, width, height)
  if (!points) return <span style={{ width, height, display: 'inline-block' }} />

  const last = history[history.length - 1]
  const first = history[0]
  const isUp = last >= first
  const lineColor = isUp ? 'var(--session-europe)' : 'var(--danger)'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', flexShrink: 0 }}
      aria-label={`${symbol} sparkline`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color === 'var(--accent)' ? lineColor : color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
})
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @sessionmap/web type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useSparklines.ts apps/web/src/components/panels/PriceSparklines.tsx
git commit -m "feat: add useSparklines hook and PriceSparklines SVG component"
```

---

### Task 7: SessionVolumeBars component

**Files:**
- Create: `apps/web/src/components/panels/SessionVolumeBars.tsx`

- [ ] **Step 1: Create `apps/web/src/components/panels/SessionVolumeBars.tsx`**

```typescript
'use client'

import { memo } from 'react'
import { EXCHANGES, SESSION_COLORS_CSS, SESSION_LABELS } from '@/lib/constants'
import type { SessionRegion } from '@sessionmap/types'

const REGIONS: SessionRegion[] = ['asia', 'europe', 'americas']

function computeVolumes(): Record<SessionRegion, number> {
  const totals: Record<SessionRegion, number> = { asia: 0, europe: 0, americas: 0 }
  for (const ex of EXCHANGES) {
    totals[ex.region] += ex.vol
  }
  return totals
}

// Precompute once (static data)
const VOLUMES = computeVolumes()
const MAX_VOL = Math.max(...Object.values(VOLUMES))

interface SessionVolumeBarsProps {
  compact?: boolean
}

export const SessionVolumeBars = memo(function SessionVolumeBars({ compact = false }: SessionVolumeBarsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '3px' : '5px' }}>
      {!compact && (
        <div style={{
          fontSize: '9px', color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: '2px',
        }}>
          Exchange Volume by Region
        </div>
      )}
      {REGIONS.map(region => {
        const vol = VOLUMES[region]
        const pct = (vol / MAX_VOL) * 100

        return (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-mono, monospace)',
              color: SESSION_COLORS_CSS[region],
              width: compact ? '50px' : '70px', flexShrink: 0,
              letterSpacing: '0.04em',
            }}>
              {SESSION_LABELS[region].toUpperCase()}
            </span>
            <div style={{
              flex: 1, height: compact ? '3px' : '4px',
              background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct.toFixed(1)}%`, height: '100%',
                background: SESSION_COLORS_CSS[region],
                borderRadius: '2px',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--fg-muted)', width: '36px', textAlign: 'right', flexShrink: 0,
            }}>
              ${vol.toFixed(0)}B
            </span>
          </div>
        )
      })}
    </div>
  )
})
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @sessionmap/web type-check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/panels/SessionVolumeBars.tsx
git commit -m "feat: add SessionVolumeBars component showing exchange volume by region"
```

---

### Task 8: Altcoin Season utility + AltcoinSeasonBadge

**Files:**
- Create: `apps/web/src/lib/altcoin-season.ts`
- Create: `apps/web/src/components/panels/AltcoinSeasonBadge.tsx`

- [ ] **Step 1: Create `apps/web/src/lib/altcoin-season.ts`**

```typescript
import type { PriceSnapshot } from '@sessionmap/types'

const ALTCOINS = ['ETH', 'SOL', 'BNB', 'XRP'] as const

export interface AltcoinSeasonResult {
  score: number  // 0-100
  label: string
  outperformers: number
  total: number
}

export function computeAltcoinSeason(prices: PriceSnapshot): AltcoinSeasonResult {
  const btcChange = prices['BTC']?.change24h ?? 0
  let outperformers = 0
  let total = 0

  for (const sym of ALTCOINS) {
    const entry = prices[sym]
    if (!entry) continue
    total++
    if (entry.change24h > btcChange) outperformers++
  }

  const score = total === 0 ? 0 : Math.round((outperformers / total) * 100)

  let label: string
  if (score >= 75) label = 'Altcoin Season'
  else if (score >= 50) label = 'Mixed'
  else if (score >= 25) label = 'Leaning BTC'
  else label = 'Bitcoin Season'

  return { score, label, outperformers, total }
}
```

- [ ] **Step 2: Create `apps/web/src/components/panels/AltcoinSeasonBadge.tsx`**

```typescript
'use client'

import { memo } from 'react'
import { computeAltcoinSeason } from '@/lib/altcoin-season'
import type { PriceSnapshot } from '@sessionmap/types'

interface AltcoinSeasonBadgeProps {
  prices: PriceSnapshot
  compact?: boolean
}

export const AltcoinSeasonBadge = memo(function AltcoinSeasonBadge({ prices, compact = false }: AltcoinSeasonBadgeProps) {
  const { score, label } = computeAltcoinSeason(prices)

  const color = score >= 75
    ? 'var(--session-americas)'
    : score >= 50
      ? 'var(--accent-warm)'
      : score >= 25
        ? 'var(--fg-muted)'
        : 'var(--accent)'

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Alt Season
        </span>
        <span style={{ fontSize: '10px', color, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
          {score}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Altcoin Season
        </span>
        <span style={{ fontSize: '11px', color, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
          {score} — {label}
        </span>
      </div>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-warm) 50%, var(--session-americas) 100%)`,
          borderRadius: '2px',
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
})
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @sessionmap/web type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/altcoin-season.ts apps/web/src/components/panels/AltcoinSeasonBadge.tsx
git commit -m "feat: add altcoin season computation and AltcoinSeasonBadge component"
```

---

### Task 9: useLiveExchanges hook

**Files:**
- Create: `apps/web/src/hooks/useLiveExchanges.ts`

- [ ] **Step 1: Create `apps/web/src/hooks/useLiveExchanges.ts`**

This hook fetches CoinGecko's `/exchanges` endpoint every 5 minutes and returns a map of exchange-id → 24h USD volume. Exchange IDs are matched to our static `EXCHANGES` list by name/id.

```typescript
'use client'

import { useState, useEffect } from 'react'

// Maps CoinGecko exchange IDs to our internal IDs
const CGID_MAP: Record<string, string> = {
  binance:       'binance',
  okx:           'okx',
  bybit_spot:    'bybit',
  coinbase:      'coinbase',
  htx:           'htx',
  kucoin:        'kucoin',
  kraken:        'kraken',
  bitfinex:      'bitfinex',
  upbit:         'upbit',
  gate:          'gate',
  mexc:          'mexc',
  bitmex:        'bitmex',
  bithumb:       'bithumb',
  gemini:        'gemini',
  bitstamp:      'bitstamp',
}

interface CoinGeckoExchange {
  id: string
  trade_volume_24h_btc: number
}

export function useLiveExchanges(btcPrice: number): Map<string, number> {
  const [volMap, setVolMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!btcPrice) return

    async function fetchExchanges() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/exchanges?per_page=50&page=1',
          { signal: AbortSignal.timeout(10000) }
        )
        if (!res.ok) return
        const data = (await res.json()) as CoinGeckoExchange[]
        const next = new Map<string, number>()
        for (const ex of data) {
          const localId = CGID_MAP[ex.id]
          if (localId) {
            // Convert BTC volume to USD
            next.set(localId, ex.trade_volume_24h_btc * btcPrice / 1e9)
          }
        }
        setVolMap(next)
      } catch {
        // ignore — keep showing static data
      }
    }

    fetchExchanges()
    const id = setInterval(fetchExchanges, 5 * 60_000)
    return () => clearInterval(id)
  }, [btcPrice])

  return volMap
}
```

- [ ] **Step 2: Update `apps/web/src/components/globe/ExchangeLabels.tsx`** to accept `liveVol` prop and use it in tooltip

Add `liveVol` to props interface:
```typescript
interface ExchangeLabelsProps {
  hoveredId: string | null
  onHover: (id: string | null) => void
  liveVol?: Map<string, number>
}
```

In the component signature:
```typescript
export const ExchangeLabels = memo(function ExchangeLabels({ hoveredId, onHover, liveVol }: ExchangeLabelsProps) {
```

In the `'24h Vol'` tooltip row, replace `$${ex.vol.toFixed(1)}B` with:
```typescript
const displayVol = liveVol?.get(ex.id) ?? ex.vol
// in tooltip:
['24h Vol', `$${displayVol.toFixed(1)}B`],
```

- [ ] **Step 3: Wire in `apps/web/src/app/(dashboard)/page.tsx`**

Add import at top:
```typescript
import { useLiveExchanges } from '@/hooks/useLiveExchanges'
```

Inside `SessionMapApp`, after existing hooks:
```typescript
const liveVol = useLiveExchanges(prices['BTC']?.price ?? 0)
```

Pass to `ExchangeLabels`:
```tsx
<ExchangeLabels
  hoveredId={hoveredExchangeId}
  onHover={setHoveredExchangeId}
  liveVol={liveVol}
/>
```

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @sessionmap/web type-check
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useLiveExchanges.ts apps/web/src/components/globe/ExchangeLabels.tsx apps/web/src/app/(dashboard)/page.tsx
git commit -m "feat: add useLiveExchanges fetching CoinGecko volumes, show live vol in exchange tooltip"
```

---

### Task 10: Heatmap globe mode

**Files:**
- Modify: `apps/web/src/components/panels/GlobeModeBar.tsx`
- Modify: `apps/web/src/components/globe/ExchangeLabels.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Update `apps/web/src/components/panels/GlobeModeBar.tsx`**

Replace `MODE_META` and the type assertion to include `heatmap`:

```typescript
'use client'

import { memo } from 'react'
import type { GlobeMode } from '@sessionmap/types'

const MODE_META: Record<GlobeMode, { label: string; icon: string; tip: string }> = {
  auto:    { label: 'Auto',    icon: '↺', tip: 'Slow auto-rotation' },
  free:    { label: 'Free',    icon: '✦', tip: 'Drag to explore' },
  follow:  { label: 'Follow',  icon: '☀', tip: 'Camera tracks dayside' },
  heatmap: { label: 'Heatmap', icon: '⬡', tip: 'Color exchanges by volume' },
}

interface GlobeModeBarProps {
  mode: GlobeMode
  onChange: (mode: GlobeMode) => void
}

export const GlobeModeBar = memo(function GlobeModeBar({ mode, onChange }: GlobeModeBarProps) {
  return (
    <div style={{ display: 'flex', gap: '4px', pointerEvents: 'all' }}>
      {(Object.entries(MODE_META) as [GlobeMode, typeof MODE_META[GlobeMode]][]).map(([key, meta]) => {
        const active = mode === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={meta.tip}
            style={{
              background: active ? 'rgba(125,211,252,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '6px',
              padding: '5px 11px',
              cursor: 'pointer',
              color: active ? 'var(--accent)' : 'var(--fg-muted)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '13px', lineHeight: 1 }}>{meta.icon}</span>
            {meta.label}
          </button>
        )
      })}
    </div>
  )
})
```

- [ ] **Step 2: Update `apps/web/src/components/globe/ExchangeLabels.tsx`** to accept `globeMode` prop and heat-color dots

Add to imports: `import type { GlobeMode } from '@sessionmap/types'`

Update `ExchangeLabelsProps`:
```typescript
interface ExchangeLabelsProps {
  hoveredId: string | null
  onHover: (id: string | null) => void
  liveVol?: Map<string, number>
  globeMode?: GlobeMode
}
```

Add heat-color helper before the component:
```typescript
const MAX_STATIC_VOL = 76.4 // Binance vol — used for normalization

function heatColor(vol: number): string {
  const t = Math.min(1, vol / MAX_STATIC_VOL)
  if (t > 0.6) return `hsl(${Math.round(60 - t * 60)}, 100%, 60%)`   // yellow → red
  if (t > 0.2) return `hsl(${Math.round(120 - t * 100)}, 80%, 55%)`  // green → yellow
  return 'hsl(120, 60%, 40%)'  // dim green for low volume
}
```

Update the component signature:
```typescript
export const ExchangeLabels = memo(function ExchangeLabels({ hoveredId, onHover, liveVol, globeMode }: ExchangeLabelsProps) {
```

Inside the render loop, replace `const col = SESSION_COLORS_HEX[ex.region]` with:
```typescript
const displayVol = liveVol?.get(ex.id) ?? ex.vol
const col = globeMode === 'heatmap' ? heatColor(displayVol) : SESSION_COLORS_HEX[ex.region]
```

Update the tooltip `'24h Vol'` row to use `displayVol`:
```typescript
['24h Vol', `$${displayVol.toFixed(1)}B`],
```

Also update dot size when in heatmap mode (larger dots to emphasize volume):
```typescript
const dotSize = globeMode === 'heatmap'
  ? Math.max(5, Math.min(14, Math.round((displayVol / MAX_STATIC_VOL) * 14)))
  : isLarge ? 10 : isMed ? 7 : 5
```

Replace the dot `<div>` style:
```tsx
<div style={{
  width: dotSize,
  height: dotSize,
  borderRadius: '50%',
  background: col,
  boxShadow: `0 0 ${isHovered ? 12 : globeMode === 'heatmap' ? 8 : 6}px ${col}`,
  margin: 'auto',
  transition: 'box-shadow 0.2s, background 0.4s',
}} />
```

- [ ] **Step 3: Update `apps/web/src/app/(dashboard)/page.tsx`** to pass `globeMode` to `ExchangeLabels`

```tsx
<ExchangeLabels
  hoveredId={hoveredExchangeId}
  onHover={setHoveredExchangeId}
  liveVol={liveVol}
  globeMode={globeMode}
/>
```

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @sessionmap/web type-check
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/panels/GlobeModeBar.tsx apps/web/src/components/globe/ExchangeLabels.tsx apps/web/src/app/(dashboard)/page.tsx
git commit -m "feat: add heatmap globe mode with volume-based exchange dot colors"
```

---

### Task 11: usePriceAlerts + PriceAlertsPanel

**Files:**
- Create: `apps/web/src/hooks/usePriceAlerts.ts`
- Create: `apps/web/src/components/panels/PriceAlertsPanel.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Modify: `apps/web/src/components/panels/CleanUI.tsx`

- [ ] **Step 1: Create `apps/web/src/hooks/usePriceAlerts.ts`**

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PriceSnapshot } from '@sessionmap/types'

export interface PriceAlert {
  id: string
  symbol: string
  direction: 'above' | 'below'
  threshold: number
  createdAt: number
}

const STORAGE_KEY = 'sessionmap_price_alerts'

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PriceAlert[]) : []
  } catch {
    return []
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
  } catch {
    // ignore storage errors
  }
}

export function usePriceAlerts(prices: PriceSnapshot) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const firedRef = useRef<Set<string>>(new Set())

  // Load from localStorage on mount
  useEffect(() => {
    setAlerts(loadAlerts())
  }, [])

  // Check alerts on every price update
  useEffect(() => {
    for (const alert of alerts) {
      const entry = prices[alert.symbol]
      if (!entry) continue
      const key = `${alert.id}-${alert.threshold}`
      const triggered =
        alert.direction === 'above'
          ? entry.price >= alert.threshold
          : entry.price <= alert.threshold

      if (triggered && !firedRef.current.has(key)) {
        firedRef.current.add(key)
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(`SessionMap Alert: ${alert.symbol}`, {
              body: `${alert.symbol} is ${alert.direction} $${alert.threshold.toLocaleString()}`,
              icon: '/favicon.ico',
            })
          }
        }
      } else if (!triggered) {
        // Reset so alert can fire again if price crosses back
        firedRef.current.delete(key)
      }
    }
  }, [prices, alerts])

  const addAlert = useCallback((symbol: string, direction: 'above' | 'below', threshold: number) => {
    setAlerts(prev => {
      const next = [...prev, { id: `${Date.now()}`, symbol, direction, threshold, createdAt: Date.now() }]
      saveAlerts(next)
      return next
    })
  }, [])

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id)
      saveAlerts(next)
      return next
    })
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      await Notification.requestPermission()
    }
  }, [])

  return { alerts, addAlert, removeAlert, requestNotificationPermission }
}
```

- [ ] **Step 2: Create `apps/web/src/components/panels/PriceAlertsPanel.tsx`**

```typescript
'use client'

import { useState, memo } from 'react'
import type { PriceAlert } from '@/hooks/usePriceAlerts'
import type { PriceSnapshot } from '@sessionmap/types'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']

interface PriceAlertsPanelProps {
  open: boolean
  onClose: () => void
  alerts: PriceAlert[]
  prices: PriceSnapshot
  onAdd: (symbol: string, direction: 'above' | 'below', threshold: number) => void
  onRemove: (id: string) => void
  onRequestPermission: () => void
}

export const PriceAlertsPanel = memo(function PriceAlertsPanel({
  open,
  onClose,
  alerts,
  prices,
  onAdd,
  onRemove,
  onRequestPermission,
}: PriceAlertsPanelProps) {
  const [symbol, setSymbol] = useState('BTC')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [thresholdStr, setThresholdStr] = useState('')

  if (!open) return null

  function handleAdd() {
    const threshold = parseFloat(thresholdStr)
    if (isNaN(threshold) || threshold <= 0) return
    onAdd(symbol, direction, threshold)
    setThresholdStr('')
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '60px',
    right: '28px',
    width: '280px',
    background: 'rgba(8,11,20,0.97)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '12px',
    padding: '14px 16px',
    zIndex: 50,
    pointerEvents: 'all',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '9px', color: 'var(--fg-muted)',
    fontFamily: 'var(--font-mono, monospace)',
    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px', padding: '5px 10px',
    color: 'var(--fg)', fontSize: '12px',
    fontFamily: 'var(--font-mono, monospace)',
    width: '100%', outline: 'none',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
  const btnStyle: React.CSSProperties = {
    background: 'rgba(125,211,252,0.12)',
    border: '1px solid var(--accent)',
    borderRadius: '6px', padding: '5px 14px',
    color: 'var(--accent)', fontSize: '11px',
    fontFamily: 'var(--font-mono, monospace)',
    cursor: 'pointer', letterSpacing: '0.06em',
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em' }}>
          PRICE ALERTS
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: '14px' }}>×</button>
      </div>

      {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
        <button onClick={onRequestPermission} style={{ ...btnStyle, width: '100%', marginBottom: '10px' }}>
          Enable Notifications
        </button>
      )}

      {/* Add alert form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div>
          <div style={labelStyle}>Symbol</div>
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}>
            {SYMBOLS.map(s => <option key={s} value={s}>{s} — ${(prices[s]?.price ?? 0).toLocaleString()}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={labelStyle}>Direction</div>
            <select value={direction} onChange={e => setDirection(e.target.value as 'above' | 'below')} style={selectStyle}>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Price ($)</div>
            <input
              type="number"
              value={thresholdStr}
              onChange={e => setThresholdStr(e.target.value)}
              placeholder="0"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        <button onClick={handleAdd} style={btnStyle}>+ Add Alert</button>
      </div>

      {/* Existing alerts */}
      {alerts.length === 0 ? (
        <div style={{ fontSize: '10px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono, monospace)' }}>No alerts set</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {alerts.map(alert => {
            const current = prices[alert.symbol]?.price ?? 0
            const triggered = alert.direction === 'above' ? current >= alert.threshold : current <= alert.threshold
            return (
              <div key={alert.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 8px', borderRadius: '5px',
                background: triggered ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${triggered ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <span style={{ fontSize: '10px', color: triggered ? 'var(--danger)' : 'var(--fg)', fontFamily: 'var(--font-mono, monospace)' }}>
                  {alert.symbol} {alert.direction} ${alert.threshold.toLocaleString()}
                </span>
                <button
                  onClick={() => onRemove(alert.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                >×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
```

- [ ] **Step 3: Wire hooks and panel in `apps/web/src/app/(dashboard)/page.tsx`**

Add import at top:
```typescript
import { usePriceAlerts } from '@/hooks/usePriceAlerts'
import { PriceAlertsPanel } from '@/components/panels/PriceAlertsPanel'
```

Inside `SessionMapApp`, add:
```typescript
const { alerts, addAlert, removeAlert, requestNotificationPermission } = usePriceAlerts(prices)
const [alertsPanelOpen, setAlertsPanelOpen] = useState(false)
```

Add `PriceAlertsPanel` in the JSX inside `#ui-root` before `TerminalUI`/`CleanUI`:
```tsx
<PriceAlertsPanel
  open={alertsPanelOpen}
  onClose={() => setAlertsPanelOpen(false)}
  alerts={alerts}
  prices={prices}
  onAdd={addAlert}
  onRemove={removeAlert}
  onRequestPermission={requestNotificationPermission}
/>
```

Pass `onToggleAlerts` to `CleanUI`:
```tsx
<CleanUI
  ...
  onToggleAlerts={() => setAlertsPanelOpen(p => !p)}
  alertCount={alerts.length}
/>
```

- [ ] **Step 4: Add alerts button to `apps/web/src/components/panels/CleanUI.tsx`**

Add to `CleanUIProps`:
```typescript
onToggleAlerts: () => void
alertCount: number
```

Add an alerts button in the top bar right section (after the Terminal button):
```tsx
<button
  onClick={onToggleAlerts}
  style={{
    pointerEvents: 'all', background: alertCount > 0 ? 'rgba(248,113,113,0.10)' : 'none',
    border: `1px solid ${alertCount > 0 ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '7px',
    color: alertCount > 0 ? 'var(--danger)' : 'var(--fg-muted)',
    fontSize: '11px', fontFamily: 'var(--font-mono, monospace)',
    letterSpacing: '0.08em', transition: 'all 0.3s ease',
  }}
>
  <span style={{ fontSize: '12px' }}>🔔</span>
  {alertCount > 0 ? `Alerts (${alertCount})` : 'Alerts'}
</button>
```

- [ ] **Step 5: Type-check**

```bash
pnpm --filter @sessionmap/web type-check
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/usePriceAlerts.ts apps/web/src/components/panels/PriceAlertsPanel.tsx apps/web/src/app/(dashboard)/page.tsx apps/web/src/components/panels/CleanUI.tsx
git commit -m "feat: add price alerts with localStorage persistence and Web Notifications"
```

---

### Task 12: Integrate all new data into TerminalUI + CleanUI

**Files:**
- Modify: `apps/web/src/components/panels/TerminalUI.tsx`
- Modify: `apps/web/src/components/panels/CleanUI.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Update `TerminalUI` props interface and signature**

Add the new props:
```typescript
import { SessionVolumeBars } from './SessionVolumeBars'
import { PriceSparklines } from './PriceSparklines'
import { AltcoinSeasonBadge } from './AltcoinSeasonBadge'
import type { LiquidationEvent, FundingRateMap, EthGas } from '@sessionmap/types'

interface TerminalUIProps {
  session: SessionInfo;
  prices: PriceSnapshot;
  onToggleTerminal: () => void;
  globeMode: GlobeMode;
  onGlobeModeChange: (mode: GlobeMode) => void;
  whaleEvents: WhaleEvent[];
  fearGreed: number | null;
  liquidations: LiquidationEvent[];
  fundingRates: FundingRateMap;
  ethGas: EthGas | null;
  priceHistory: Map<string, number[]>;
  marketMeta: import('@sessionmap/types').MarketMeta | null;
}
```

- [ ] **Step 2: Add liquidations section to TerminalUI left panel**

In the left panel, after the MARKET section, add a LIQUIDATIONS section:

```tsx
{/* Liquidations */}
<div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
  <div style={hdr}>LIQUIDATIONS</div>
  {liquidations.length === 0 ? (
    <div style={{ color: 'var(--fg-dim)', fontSize: '10px', fontFamily: 'var(--font-mono, monospace)' }}>Watching…</div>
  ) : (
    liquidations.slice(0, 5).map(liq => (
      <div key={liq.id} style={{ ...row, marginBottom: '3px' }}>
        <span style={{
          fontSize: '10px', fontFamily: 'var(--font-mono, monospace)',
          color: liq.side === 'LONG' ? 'var(--danger)' : 'var(--session-europe)',
        }}>
          {liq.symbol} {liq.side}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--accent-warm)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
          ${(liq.usdValue / 1000).toFixed(0)}K
        </span>
      </div>
    ))
  )}
</div>
```

- [ ] **Step 3: Add funding rates section to TerminalUI left panel**

After the LIQUIDATIONS section:

```tsx
{/* Funding Rates */}
{Object.keys(fundingRates).length > 0 && (
  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
    <div style={hdr}>FUNDING RATES</div>
    {(['BTC', 'ETH', 'SOL'] as const).map(sym => {
      const rate = fundingRates[sym]
      if (rate === undefined) return null
      const pct = (rate * 100).toFixed(4)
      const isPos = rate >= 0
      return (
        <div key={sym} style={{ ...row, marginBottom: '3px' }}>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{sym}</span>
          <span style={{
            fontSize: '10px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
            color: isPos ? 'var(--danger)' : 'var(--session-europe)',
          }}>
            {isPos ? '+' : ''}{pct}%
          </span>
        </div>
      )
    })}
  </div>
)}
```

- [ ] **Step 4: Add ETH Gas section to TerminalUI left panel**

After funding rates:

```tsx
{/* ETH Gas */}
{ethGas && (
  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
    <div style={hdr}>ETH GAS (gwei)</div>
    <div style={{ ...row, marginBottom: '2px' }}>
      <span style={{ fontSize: '9px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono, monospace)' }}>slow</span>
      <span style={{ fontSize: '10px', color: 'var(--session-europe)', fontFamily: 'var(--font-mono, monospace)' }}>{ethGas.slow}</span>
    </div>
    <div style={{ ...row, marginBottom: '2px' }}>
      <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)' }}>standard</span>
      <span style={{ fontSize: '10px', color: 'var(--accent-warm)', fontFamily: 'var(--font-mono, monospace)' }}>{ethGas.standard}</span>
    </div>
    <div style={row}>
      <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)' }}>fast</span>
      <span style={{ fontSize: '10px', color: 'var(--danger)', fontFamily: 'var(--font-mono, monospace)' }}>{ethGas.fast}</span>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add SessionVolumeBars + AltcoinSeasonBadge to TerminalUI left panel**

After ETH Gas section:

```tsx
{/* Session Volumes */}
<div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
  <SessionVolumeBars compact />
</div>

{/* Altcoin Season */}
<div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
  <AltcoinSeasonBadge prices={prices} />
</div>
```

- [ ] **Step 6: Add sparklines to TerminalUI bottom price bar**

In the bottom price bar, inside each price cell, add the sparkline after the change percentage:

```tsx
const sparkHistory = priceHistory.get(sym) ?? []
// ... after the change span:
{sparkHistory.length >= 2 && (
  <PriceSparklines symbol={sym} history={sparkHistory} width={60} height={20} />
)}
```

- [ ] **Step 7: Add new widgets to CleanUI bottom section**

In `CleanUI.tsx`, after the existing bottom section, add:

```typescript
import { SessionVolumeBars } from './SessionVolumeBars'
import { AltcoinSeasonBadge } from './AltcoinSeasonBadge'
import type { EthGas } from '@sessionmap/types'
```

Add `ethGas` and `marketMeta` to `CleanUIProps`:
```typescript
ethGas?: EthGas | null
marketMeta?: import('@sessionmap/types').MarketMeta | null
```

In the bottom row, between the session status and price ticker, add a center column:
```tsx
{/* Center column: volume bars + altcoin season + gas */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, maxWidth: '240px' }}>
  <SessionVolumeBars compact />
  <AltcoinSeasonBadge prices={prices} compact />
  {ethGas && (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        ETH Gas
      </span>
      <span style={{ fontSize: '10px', color: 'var(--session-europe)', fontFamily: 'var(--font-mono, monospace)' }}>{ethGas.slow}</span>
      <span style={{ fontSize: '9px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono, monospace)' }}>·</span>
      <span style={{ fontSize: '10px', color: 'var(--accent-warm)', fontFamily: 'var(--font-mono, monospace)' }}>{ethGas.standard}</span>
      <span style={{ fontSize: '9px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono, monospace)' }}>·</span>
      <span style={{ fontSize: '10px', color: 'var(--danger)', fontFamily: 'var(--font-mono, monospace)' }}>{ethGas.fast}</span>
      <span style={{ fontSize: '9px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono, monospace)' }}>gwei</span>
    </div>
  )}
  {marketMeta && (
    <div style={{ display: 'flex', gap: '10px' }}>
      <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        BTC.dom
      </span>
      <span style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 500 }}>
        {(marketMeta.btcDominance ?? 0).toFixed(1)}%
      </span>
    </div>
  )}
</div>
```

- [ ] **Step 8: Wire new props in `apps/web/src/app/(dashboard)/page.tsx`**

Add `useSparklines` import and call:
```typescript
import { useSparklines } from '@/hooks/useSparklines'
// inside SessionMapApp:
const priceHistory = useSparklines(prices)
```

Pass all new props to `TerminalUI`:
```tsx
<TerminalUI
  session={session}
  prices={prices}
  onToggleTerminal={() => dispatch({ type: 'TOGGLE_TERMINAL' })}
  globeMode={globeMode}
  onGlobeModeChange={onGlobeModeChange}
  whaleEvents={whaleEvents}
  fearGreed={marketMeta?.fearGreed ?? null}
  liquidations={state.liquidations}
  fundingRates={state.fundingRates}
  ethGas={state.ethGas}
  priceHistory={priceHistory}
  marketMeta={marketMeta}
/>
```

Pass new props to `CleanUI`:
```tsx
<CleanUI
  session={session}
  prices={prices}
  onToggleTerminal={() => dispatch({ type: 'TOGGLE_TERMINAL' })}
  globeMode={globeMode}
  onGlobeModeChange={onGlobeModeChange}
  sunInfo={sunInfo}
  whaleEvents={whaleEvents}
  wsStatus={wsStatus}
  ethGas={state.ethGas}
  marketMeta={marketMeta}
  onToggleAlerts={() => setAlertsPanelOpen(p => !p)}
  alertCount={alerts.length}
/>
```

- [ ] **Step 9: Remove debug console.log from page.tsx**

In `apps/web/src/app/(dashboard)/page.tsx`, remove:
```typescript
console.log(prices, marketMeta, globeMode, terminalMode, tweaks, wsStatus);
```

- [ ] **Step 10: Type-check everything**

```bash
pnpm type-check
```
Expected: no errors across all packages.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/panels/TerminalUI.tsx apps/web/src/components/panels/CleanUI.tsx apps/web/src/app/(dashboard)/page.tsx
git commit -m "feat: integrate liquidations, funding, gas, sparklines, volume bars, altcoin season into UI"
```
