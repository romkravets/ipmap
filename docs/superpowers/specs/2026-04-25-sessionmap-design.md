# SessionMap — Design Spec
_2026-04-25_

## Overview

Rebuild SessionMap (crypto trading sessions 3D globe) from a standalone HTML prototype into a production-grade full-stack application. The app visualises global crypto trading sessions on a real-time 3D Earth with live prices, whale arc animations, and exchange markers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS + shadcn/ui |
| 3D Globe | Three.js (dynamic import, no SSR) |
| State | React Context + useReducer |
| Auth | NextAuth.js v5 (Google + GitHub — stubs, not activated) |
| WS Server | Node.js + `ws` library + Express |
| Database | MongoDB + Mongoose |
| Shared Types | `packages/types` (TypeScript) |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | Vercel (web) + Railway (server) |

---

## Repository Structure

```
sessionmap/
├── apps/
│   ├── web/                        ← Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (auth)/             ← /login page (stub UI only)
│   │   │   ├── (dashboard)/        ← / main globe page
│   │   │   └── api/
│   │   │       └── auth/[...nextauth]/  ← NextAuth route (stub)
│   │   ├── components/
│   │   │   ├── globe/
│   │   │   │   ├── GlobeScene.tsx      ← Three.js canvas + lifecycle
│   │   │   │   ├── ExchangeLabels.tsx  ← React overlay for exchange dots
│   │   │   │   └── useGlobe.ts         ← hook: init, animate, cleanup
│   │   │   ├── ui/                     ← shadcn/ui primitives
│   │   │   └── panels/
│   │   │       ├── CleanUI.tsx
│   │   │       ├── TerminalUI.tsx
│   │   │       ├── TweaksPanel.tsx     ← dynamic import (lazy)
│   │   │       ├── WhaleTicker.tsx
│   │   │       └── GlobeModeBar.tsx
│   │   ├── contexts/
│   │   │   ├── AppContext.tsx          ← Provider + useReducer
│   │   │   └── reducer.ts             ← actions + state shape
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts        ← auto-reconnect WS client
│   │   │   ├── usePrices.ts           ← subscribes to price slice
│   │   │   ├── useSession.ts          ← trading session logic
│   │   │   └── useWhaleEvents.ts
│   │   ├── lib/
│   │   │   ├── constants.ts           ← EXCHANGES, SESSION_TIMES
│   │   │   ├── session-logic.ts       ← getSessionInfo, formatCountdown
│   │   │   └── auth.ts                ← NextAuth config (stub)
│   │   └── next.config.js
│   │
│   └── server/                        ← Node.js WS + REST
│       ├── src/
│       │   ├── connectors/
│       │   │   ├── BinanceConnector.ts  ← connects to Binance WS once
│       │   │   └── CoinGeckoConnector.ts ← polls every 60s
│       │   ├── services/
│       │   │   ├── PriceService.ts      ← aggregates, caches in Map
│       │   │   └── WhaleService.ts      ← simulated whale events
│       │   ├── ws/
│       │   │   └── broadcaster.ts       ← broadcasts to all clients
│       │   ├── routes/
│       │   │   └── health.ts
│       │   └── index.ts                 ← Express + ws server entry
│       └── Dockerfile
│
├── packages/
│   ├── types/                           ← shared TypeScript types
│   │   └── src/index.ts
│   └── eslint-config/
│
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## Data Flow

```
Binance WS ──────┐
                 ▼
CoinGecko REST → PriceService (server)
                 │  aggregates + normalises
                 ▼
            WS Broadcaster
                 │  broadcasts typed messages to all clients
                 ▼
          useWebSocket hook (client)
                 │  dispatches to AppContext reducer
                 ▼
          AppContext / useReducer
         ┌───────┴────────┐
         ▼                ▼
    GlobeScene         Panels
  (Three.js refs)  (CleanUI / TerminalUI)
```

### WS Message Types (packages/types)

```ts
type WsMessage =
  | { type: 'prices'; data: PriceSnapshot }
  | { type: 'meta';   data: MarketMeta }
  | { type: 'whale';  data: WhaleEvent }

type PriceSnapshot = Record<string, { price: number; change24h: number }>
type MarketMeta = { fearGreed: number; btcDominance: number; totalMarketCap: number }
type WhaleEvent = { id: string; type: 'transfer'|'deposit'|'withdraw'|'dex'; amount: number; from: string; to: string; ts: number }
```

### PriceService behaviour
- Connects to Binance WS once on server start (`!ticker@arr` stream)
- Keeps latest prices in a `Map<symbol, PriceSnapshot>`
- New clients receive a snapshot immediately on connection
- CoinGecko polled every 60 s; result cached, broadcast on change

### useWebSocket
- Auto-reconnect with exponential backoff (1s → 2s → 4s → max 30s)
- Shows stale-data indicator in UI when disconnected
- Validates incoming messages with Zod before dispatch

---

## Authentication (Stubs)

- NextAuth.js v5 installed and configured with Google + GitHub providers
- `/login` page renders provider buttons — clicking does nothing (no client IDs configured)
- `getServerSession()` available in Server Components for future gating
- MongoDB NextAuth adapter installed — will store users/sessions once activated
- `NEXTAUTH_SECRET` required in env even for stubs

---

## Security

| Concern | Solution |
|---------|---------|
| WS origin abuse | CORS whitelist — only Vercel app domain |
| WS flood | Rate limit: 100 connections/IP via `express-rate-limit` |
| HTTP headers | `helmet()` on all Express routes |
| XSS / injection | `Content-Security-Policy` in `next.config.js` headers |
| Secrets | All via env vars, `.env.example` has no values |
| MongoDB injection | Mongoose `sanitizeFilter: true` |
| User input | Zod schemas for all future settings mutations |
| Auth secrets | `NEXTAUTH_SECRET` via env, never hardcoded |

CSP allows: `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com` — required for Three.js textures and fonts.

---

## Performance & Optimisation

### Globe / Three.js
- `dynamic(() => import('./GlobeScene'), { ssr: false })` — no SSR
- Three.js objects in `useRef` — zero React re-renders during animation loop
- Object pooling for whale arc geometries — no per-frame malloc
- Earth textures preloaded via `<link rel="preload">` in `<head>`

### React
- `React.memo` on `ExchangeLabels`, `CleanUI`, `TerminalUI`
- Price updates batched via `requestAnimationFrame` before dispatch
- `useMemo` for session overlap + volatility calculations
- `TweaksPanel` loaded via `next/dynamic` — only when opened

### Bundle
- Three.js via npm with tree-shaking (not CDN)
- `next/font` for Inter + JetBrains Mono — no external font request at runtime
- `turbo build` caches unchanged packages

---

## Design Patterns

| Pattern | Applied in |
|---------|-----------|
| Observer | WS broadcaster → client subscribers |
| Singleton | PriceService, Binance WS connection |
| Factory | Exchange marker creation in useGlobe |
| Strategy | Globe modes: auto / free / follow |
| Repository | MongoDB user settings (future) |
| Adapter | BinanceConnector, CoinGeckoConnector |

---

## AppContext State Shape

```ts
interface AppState {
  prices: PriceSnapshot
  marketMeta: MarketMeta | null
  whaleEvents: WhaleEvent[]
  session: SessionInfo
  globeMode: 'auto' | 'free' | 'follow'
  terminalMode: boolean
  tweaks: TweakValues
  wsStatus: 'connecting' | 'connected' | 'disconnected'
}
```

---

## Environment Variables

### apps/web (.env.local)
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
NEXT_PUBLIC_WS_URL=ws://localhost:4000
MONGODB_URI=
```

### apps/server (.env)
```
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
MONGODB_URI=
BINANCE_WS_URL=wss://stream.binance.com:9443/ws/!ticker@arr
COINGECKO_API_URL=https://api.coingecko.com/api/v3
```

---

## Out of Scope (this iteration)

- Real OAuth sign-in (stubs only)
- On-chain whale data (simulated)
- User settings persistence to MongoDB (schema ready, no UI)
- Mobile responsive layout
- i18n
