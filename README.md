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
cp apps/web/.env.example apps/web/.env.local
```

Edit as needed. The only required key for offline dev is `NEXTAUTH_SECRET`.

### Run (development)

```bash
pnpm dev                          # http://localhost:3000

# Якщо Next кешує старе після великих змін:
rm -rf apps/web/.next && pnpm dev
```

### Generate data

```bash
node scripts/build-ipv4-data.mjs      # ipv4-by-country.json, centroids.json
node scripts/build-infra-data.mjs     # datacenters.json, ixps.json, submarine-cables.json
```

---

## Project structure

```
ipmap/
├── apps/
│   └── web/          ← Next.js 14 (port 3000)
├── packages/
│   └── types/        ← Shared TypeScript types
├── scripts/           ← ETL: RIR delegated stats → JSON datasets
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
| `MONGODB_URI`        | —                       | Optional (NextAuth sessions) |

---

## Build for production

```bash
pnpm build
```

Деплой — Render (`render.yaml`), білд генерує датасети з ETL-скриптів перед `next build`.
