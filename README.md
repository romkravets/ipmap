# SessionMap MVP

Crypto trading sessions visualised on a real-time 3D globe — live prices, whale arc animations, and exchange markers.


## Демо

[![SessionMap](https://img.youtube.com/vi/A4CsLx5VScA/maxresdefault.jpg)](https://youtu.be/A4CsLx5VScA?si=9BCMOei7E7ZpkVwp)

## Stack

| Layer        | Technology                    |
| ------------ | ----------------------------- |
| Framework    | Next.js 14 App Router         |
| Styling      | Tailwind CSS                  |
| 3D Globe     | Three.js (client-only)        |
| State        | React Context + useReducer    |
| WS Server    | Node.js + `ws` + Express      |
| Shared Types | `packages/types` (TypeScript) |
| Monorepo     | pnpm workspaces + Turborepo   |

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)

### Install

```bash
pnpm install
```

### Environment variables

```bash
# Web
cp apps/web/.env.example apps/web/.env.local

# Server
cp apps/server/.env.example apps/server/.env
```

Edit both `.env` files as needed. The only required key for offline dev is `NEXTAUTH_SECRET`.

### Run (development)

```bash
# Start both web and server together
pnpm dev



 Рішення — видалити кеш і перезапустити dev сервер:

  rm -rf apps/web/.next
  pnpm --filter @sessionmap/web dev

  Або якщо запускаєте обидва сервіси разом:

  rm -rf apps/web/.next
  pnpm dev


# Or individually
pnpm --filter @sessionmap/web dev      # http://localhost:3000
pnpm --filter @sessionmap/server dev   # ws://localhost:4000
```

The web app shows simulated data (fallback prices + local whale arc spawner) even if the server is unreachable. The `STALE` badge appears in the top bar when the WebSocket is disconnected.

---

## Project structure

```
sessionmap/
├── apps/
│   ├── web/          ← Next.js 14 (port 3000)
│   └── server/       ← Express + ws (port 4000)
├── packages/
│   └── types/        ← Shared TypeScript types
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Key features

| Feature          | Description                                                           |
| ---------------- | --------------------------------------------------------------------- |
| 3D Globe         | Custom GLSL shaders, day/night side, atmosphere glow, terminator line |
| Sun marker       | Real-time solar position, follow-sun camera mode                      |
| Exchange markers | 20 major venues, colour-coded by session region, hover tooltip        |
| Whale arcs       | Animated great-circle arcs for simulated (or live) whale transfers    |
| Session logic    | Asia / Europe / Americas sessions, countdown, overlap detection       |
| Terminal mode    | Click **Terminal** or receive live feed in monospace hacker UI        |
| Tweaks panel     | Press **E** — rotation speed, time offset, visibility toggles         |
| WS reconnect     | Exponential backoff (1s → 2s → 4s → max 30s), Zod message validation  |

---

## Environment variables

### `apps/web/.env.local`

| Variable             | Default                 | Description                  |
| -------------------- | ----------------------- | ---------------------------- |
| `NEXTAUTH_URL`       | `http://localhost:3000` | NextAuth base URL            |
| `NEXTAUTH_SECRET`    | —                       | Required (32+ random chars)  |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:4000`   | WS server address            |
| `MONGODB_URI`        | —                       | Optional (NextAuth sessions) |

### `apps/server/.env`

| Variable            | Default                 | Description                |
| ------------------- | ----------------------- | -------------------------- |
| `PORT`              | `4000`                  | Server port                |
| `CLIENT_ORIGIN`     | `http://localhost:3000` | CORS + WS origin whitelist |
| `BINANCE_WS_URL`    | Binance `!ticker@arr`   | Override for testing       |
| `COINGECKO_API_URL` | CoinGecko v3            | Override for testing       |
| `MONGODB_URI`       | —                       | Optional (user settings)   |

---

## Build for production

```bash
pnpm build
```

Web → Vercel, Server → Railway (see `apps/server/Dockerfile`).
