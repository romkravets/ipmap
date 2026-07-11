# ipmap Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перетворити sessionmap (3D-глобус крипто-бірж) на ipmap — візуалізацію розподілу IPv4-адресного простору по країнах на Three.js-глобусі з трьома рівнями деталізації (Світ → Країна → Блок+RDAP).

**Architecture:** Видаляємо крипто-шар (WS-сервер, ціни, whale arcs, exchange markers) комітами по одному модулю; після кожного видалення глобус повинен рендеритися. Потім додаємо IPv4-шар: ETL-скрипт генерує статичні JSON, хук `useIpData` завантажує їх, `useGlobe` рендерить country-маркери та block-кластери через Three.js `Mesh`/`Points`; кліки обробляються raycasting.

**Tech Stack:** Next.js 14 App Router, Three.js, Tailwind CSS, pnpm workspaces, Turborepo, Node.js ETL (ESM), RDAP REST API.

## Global Constraints

- Node.js ≥ 20, pnpm ≥ 9
- Пакет типів: `@ipmap/types` (після перейменування)
- Код і змінні — англійською; коментарі та UI-текст — українською
- Числа завжди форматувати (`1.6 млрд`, `12 млн`), не сирий int
- Порівняння IP — через BigInt, не рядкове
- Не чіпати GLSL-шейдери, атмосферу, terminator, sun marker без потреби
- Після кожного задачі глобус повинен рендеритися: `pnpm --filter @ipmap/web dev`
- Маленькі коміти після кожної задачі

---

## File Structure

**Перейменовуються:**
- `package.json` (root): `name` → `"ipmap"`
- `packages/types/package.json`: `name` → `"@ipmap/types"`
- `apps/web/package.json`: `name` → `"@ipmap/web"`, dep → `"@ipmap/types"`
- `apps/server/package.json`: `name` → `"@ipmap/server"`, dep → `"@ipmap/types"`

**Видаляються (server):**
- `apps/server/src/connectors/` — всі 8 файлів
- `apps/server/src/ws/broadcaster.ts`
- `apps/server/src/services/PriceService.ts`
- `apps/server/src/services/WhaleService.ts`
- `apps/server/src/services/__tests__/WhaleService.test.ts`

**Видаляються (web hooks):**
- `apps/web/src/hooks/useWebSocket.ts`
- `apps/web/src/hooks/useSession.ts`
- `apps/web/src/hooks/useWhaleEvents.ts`
- `apps/web/src/hooks/useSparklines.ts`
- `apps/web/src/hooks/useLiveExchanges.ts`
- `apps/web/src/hooks/usePriceAlerts.ts`
- `apps/web/src/hooks/useStockTicker.ts`
- `apps/web/src/hooks/useCorrelation.ts`

**Видаляються (web lib):**
- `apps/web/src/lib/altcoin-season.ts`
- `apps/web/src/lib/correlation.ts`
- `apps/web/src/lib/yahoo-finance.ts`
- `apps/web/src/lib/economic-data.ts`
- `apps/web/src/lib/session-logic.ts`
- `apps/web/src/lib/__tests__/session-logic.test.ts`
- `apps/web/src/lib/__tests__/constants.test.ts`

**Видаляються (web components):**
- `apps/web/src/components/globe/ExchangeLabels.tsx`
- `apps/web/src/components/globe/StockMarketLabels.tsx`
- `apps/web/src/components/globe/WorldCapitals.tsx`
- `apps/web/src/components/globe/EconomicOverlay.tsx`
- `apps/web/src/components/globe/StrategicStraits.tsx`
- `apps/web/src/components/panels/WhaleTicker.tsx`
- `apps/web/src/components/panels/SeasonWidget.tsx`
- `apps/web/src/components/panels/SessionVolumeBars.tsx`
- `apps/web/src/components/panels/AltcoinSeasonBadge.tsx`
- `apps/web/src/components/panels/PriceSparklines.tsx`
- `apps/web/src/components/panels/PriceAlertsPanel.tsx`
- `apps/web/src/components/panels/CleanUI.tsx`
- `apps/web/src/components/panels/TerminalUI.tsx`
- `apps/web/src/components/panels/GlobeModeBar.tsx`

**Видаляються (web api routes):**
- `apps/web/src/app/api/corr/route.ts`
- `apps/web/src/app/api/exchanges/route.ts`
- `apps/web/src/app/api/stocks/route.ts`

**Змінюються:**
- `packages/types/src/index.ts` — замінюється цілком: нові типи IP-map
- `apps/server/src/index.ts` — спрощується: прибрати WS, лишити Express + health
- `apps/web/src/contexts/reducer.ts` — замінюється: тільки globeMode/tweaks/terminal
- `apps/web/src/contexts/AppContext.tsx` — оновити тип
- `apps/web/src/hooks/useGlobe.ts` — видалити whale arcs + exchange markers; додати country/block rendering
- `apps/web/src/components/globe/GlobeScene.tsx` — оновити props + import
- `apps/web/src/app/(dashboard)/page.tsx` — спростити: видалити крипто-хуки, підключити useIpData
- `apps/web/src/lib/constants.ts` — видалити EXCHANGES, STOCK_MARKETS, SESSION_COLORS

**Створюються:**
- `apps/web/src/lib/sun.ts` — витягнутий `getSunLatLng`
- `apps/web/src/hooks/useIpData.ts` — завантаження ipv4-by-country.json + centroids.json
- `apps/web/src/lib/rdap.ts` — RDAP on-demand + in-memory cache
- `apps/web/src/components/panels/CountryPanel.tsx` — інфо-панель країни + кнопка Назад
- `apps/web/src/components/panels/BlockPanel.tsx` — інфо-панель RDAP для блоку
- `scripts/build-ipv4-data.mjs` — ETL: 5 RIR → ipv4-by-country.json + centroids.json
- `apps/web/public/data/ipv4-by-country.json` — генерується скриптом
- `apps/web/public/data/centroids.json` — генерується скриптом

---

## Task 1: Rename @sessionmap → @ipmap

**Files:**
- Modify: `package.json`
- Modify: `packages/types/package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/server/package.json`
- Modify (imports): `apps/web/src/app/(dashboard)/page.tsx`, `apps/web/src/hooks/useGlobe.ts`, `apps/web/src/components/globe/GlobeScene.tsx`, `apps/web/src/contexts/reducer.ts` (та всі інші файли з `@sessionmap/types`)

**Interfaces:**
- Produces: пакет `@ipmap/types` доступний для всіх workspace-залежностей

- [ ] **Step 1: Оновити package.json (root)**

```json
{
  "name": "ipmap",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "build-data": "node scripts/build-ipv4-data.mjs"
  },
  "devDependencies": {
    "eslint": "^9",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Оновити packages/types/package.json**

Замінити `"name": "@sessionmap/types"` → `"name": "@ipmap/types"`. Решта без змін.

- [ ] **Step 3: Оновити apps/web/package.json**

Замінити `"name": "@sessionmap/web"` → `"name": "@ipmap/web"` та `"@sessionmap/types": "workspace:*"` → `"@ipmap/types": "workspace:*"`.

- [ ] **Step 4: Оновити apps/server/package.json**

Замінити `"name": "@sessionmap/server"` → `"name": "@ipmap/server"` та `"@sessionmap/types": "workspace:*"` → `"@ipmap/types": "workspace:*"`.

- [ ] **Step 5: Замінити всі imports в TypeScript-файлах**

```bash
grep -r "@sessionmap/types" apps/ packages/ --include="*.ts" --include="*.tsx" -l
```

Для кожного файлу зі списку замінити `@sessionmap/types` → `@ipmap/types`.

Файли що точно потребують: `apps/web/src/app/(dashboard)/page.tsx`, `apps/web/src/hooks/useGlobe.ts`, `apps/web/src/components/globe/GlobeScene.tsx`, `apps/web/src/contexts/reducer.ts`, та всі hooks що імпортують типи.

```bash
# Масова заміна
find apps packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/@sessionmap\/types/@ipmap\/types/g' {} +
```

- [ ] **Step 6: Перевстановити залежності**

```bash
pnpm install
```

Очікувано: без помилок, `node_modules/.pnpm` оновлено.

- [ ] **Step 7: Перевірити типи**

```bash
pnpm type-check
```

Очікувано: можуть бути помилки через ще не оновлений контент types/index.ts — це нормально, виправимо в Task 2. Помилок про `Cannot find module '@ipmap/types'` не повинно бути.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: rename @sessionmap/* → @ipmap/*"
```

---

## Task 2: Замінити types — нові IPv4 типи

**Files:**
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces:
  - `CountryAlloc { cc, name, ipCount, lat, lng }`
  - `IpBlock { start, size }`
  - `GlobeMode = "auto" | "free" | "follow"`
  - `TweakValues { rotationSpeed, showTerminator, showSunMarker, markerPulse, timeOffset }`
  - `AppState { globeMode, terminalMode, tweaks }`

- [ ] **Step 1: Замінити вміст packages/types/src/index.ts**

```typescript
// ── Globe types ───────────────────────────────────────────────────────────────

export type GlobeMode = "auto" | "free" | "follow";

export interface TweakValues {
  rotationSpeed: number;
  showTerminator: boolean;
  showSunMarker: boolean;
  markerPulse: boolean;
  timeOffset: number;
}

// ── App state ─────────────────────────────────────────────────────────────────

export interface AppState {
  globeMode: GlobeMode;
  terminalMode: boolean;
  tweaks: TweakValues;
}

// ── IPv4 data types ───────────────────────────────────────────────────────────

export interface CountryAlloc {
  cc: string;
  name: string;
  ipCount: number;
  lat: number;
  lng: number;
}

export interface IpBlock {
  start: string;
  size: number;
}
```

- [ ] **Step 2: Збудувати пакет типів**

```bash
pnpm --filter @ipmap/types build
```

Очікувано: `dist/index.js` та `dist/index.d.ts` без помилок.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts packages/types/dist/
git commit -m "feat(types): replace crypto types with IPv4 types"
```

---

## Task 3: Спростити AppContext і reducer

**Files:**
- Modify: `apps/web/src/contexts/reducer.ts`
- Modify: `apps/web/src/contexts/AppContext.tsx`

**Interfaces:**
- Consumes: `AppState, GlobeMode, TweakValues` з `@ipmap/types`; `TWEAK_DEFAULTS` з `@/lib/constants`
- Produces: `dispatch({ type: 'SET_GLOBE_MODE', payload: GlobeMode })`, `dispatch({ type: 'TOGGLE_TERMINAL' })`, `dispatch({ type: 'SET_TWEAK', payload: Partial<TweakValues> })`

- [ ] **Step 1: Замінити reducer.ts**

```typescript
import type { AppState, GlobeMode, TweakValues } from '@ipmap/types'
import { TWEAK_DEFAULTS } from '@/lib/constants'

export type Action =
  | { type: 'SET_GLOBE_MODE'; payload: GlobeMode }
  | { type: 'TOGGLE_TERMINAL' }
  | { type: 'SET_TWEAK'; payload: Partial<TweakValues> }

export const initialState: AppState = {
  globeMode: 'auto',
  terminalMode: false,
  tweaks: TWEAK_DEFAULTS,
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_GLOBE_MODE':
      return { ...state, globeMode: action.payload }
    case 'TOGGLE_TERMINAL':
      return { ...state, terminalMode: !state.terminalMode }
    case 'SET_TWEAK':
      return { ...state, tweaks: { ...state.tweaks, ...action.payload } }
    default:
      return state
  }
}
```

- [ ] **Step 2: Прочитати AppContext.tsx і видалити всі посилання на видалені типи**

Відкрий `apps/web/src/contexts/AppContext.tsx`. Він обгортає useReducer і надає контекст. Залиши структуру useReducer/createContext/Provider, але видали будь-які імпорти крипто-типів. Якщо там є хуки або ефекти пов'язані з цінами/WS — видали їх. Файл повинен виглядати приблизно так:

```typescript
'use client'

import { createContext, useContext, useReducer } from 'react'
import type { AppState } from '@ipmap/types'
import { reducer, initialState, type Action } from './reducer'

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
```

- [ ] **Step 3: Видалити тест reducer якщо він перевіряє крипто-дії**

```bash
rm apps/web/src/contexts/__tests__/reducer.test.ts
```

(Тести написані під стару дію `PRICES_UPDATE` тощо — вони більше не валідні.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/contexts/
git commit -m "refactor(context): simplify AppState — remove crypto state"
```

---

## Task 4: Витягнути sun.ts, видалити session-logic і crypto lib

**Files:**
- Create: `apps/web/src/lib/sun.ts`
- Delete: `apps/web/src/lib/session-logic.ts`, `apps/web/src/lib/altcoin-season.ts`, `apps/web/src/lib/correlation.ts`, `apps/web/src/lib/yahoo-finance.ts`, `apps/web/src/lib/economic-data.ts`
- Delete: `apps/web/src/lib/__tests__/session-logic.test.ts`, `apps/web/src/lib/__tests__/constants.test.ts`
- Modify: `apps/web/src/lib/constants.ts` — видалити EXCHANGES, STOCK_MARKETS, SESSION_*

**Interfaces:**
- Consumes: `getSunLatLng` з `apps/web/src/lib/session-logic.ts` (копіюємо функцію)
- Produces: `getSunLatLng(date: Date): { lat: number; lng: number }` з `@/lib/sun`

- [ ] **Step 1: Прочитати session-logic.ts і скопіювати тільки getSunLatLng**

```bash
cat apps/web/src/lib/session-logic.ts | grep -A 30 "getSunLatLng"
```

Скопіювати реалізацію `getSunLatLng` у новий файл `apps/web/src/lib/sun.ts`:

```typescript
// Розраховує положення сонця за датою (для термінатора і follow-режиму)
export function getSunLatLng(date: Date): { lat: number; lng: number } {
  // <вставити скопійовану реалізацію з session-logic.ts>
}
```

- [ ] **Step 2: Видалити lib-файли крипто-ери**

```bash
rm apps/web/src/lib/session-logic.ts
rm apps/web/src/lib/altcoin-season.ts
rm apps/web/src/lib/correlation.ts
rm apps/web/src/lib/yahoo-finance.ts
rm apps/web/src/lib/economic-data.ts
rm apps/web/src/lib/__tests__/session-logic.test.ts
rm apps/web/src/lib/__tests__/constants.test.ts
```

- [ ] **Step 3: Спростити constants.ts**

Видалити з `apps/web/src/lib/constants.ts`:
- `EXCHANGES` масив (рядки ~109–350)
- `STOCK_MARKETS` масив та `StockMarket` інтерфейс (рядки ~5–77)
- `isStockMarketOpen` функція
- `SESSION_TIMES`, `SESSION_COLORS_CSS`, `SESSION_COLORS_HEX`, `SESSION_LABELS`
- Імпорт `type { Exchange } from "@ipmap/types"` (Exchange типу більше нема)

Залишити тільки `TWEAK_DEFAULTS`:

```typescript
export const TWEAK_DEFAULTS = {
  rotationSpeed: 30,
  showTerminator: true,
  showSunMarker: true,
  markerPulse: true,
  timeOffset: 0,
}
```

- [ ] **Step 4: Перевірити типи**

```bash
pnpm --filter @ipmap/web type-check 2>&1 | head -40
```

Очікувано: помилки лише про відсутні imports у файлах що ще не прибрані (page.tsx, useGlobe.ts тощо) — нормально.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/
git commit -m "refactor: extract sun.ts, delete crypto lib files"
```

---

## Task 5: Видалити крипто-хуки

**Files:**
- Delete: `apps/web/src/hooks/useWebSocket.ts`, `useSession.ts`, `useWhaleEvents.ts`, `useSparklines.ts`, `useLiveExchanges.ts`, `usePriceAlerts.ts`, `useStockTicker.ts`, `useCorrelation.ts`

**Interfaces:**
- Produces: хуки більше не доступні; page.tsx буде оновлено в Task 9

- [ ] **Step 1: Видалити всі крипто-хуки**

```bash
rm apps/web/src/hooks/useWebSocket.ts
rm apps/web/src/hooks/useSession.ts
rm apps/web/src/hooks/useWhaleEvents.ts
rm apps/web/src/hooks/useSparklines.ts
rm apps/web/src/hooks/useLiveExchanges.ts
rm apps/web/src/hooks/usePriceAlerts.ts
rm apps/web/src/hooks/useStockTicker.ts
rm apps/web/src/hooks/useCorrelation.ts
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/
git commit -m "refactor: delete crypto hooks (WS, prices, whale, session)"
```

---

## Task 6: Видалити крипто-компоненти і API routes

**Files:**
- Delete: всі компоненти зі списку file structure вище
- Delete: `apps/web/src/app/api/corr/`, `apps/web/src/app/api/exchanges/`, `apps/web/src/app/api/stocks/`

**Interfaces:**
- Produces: чистий `components/` і `app/api/` без крипто-специфіки

- [ ] **Step 1: Видалити globe overlays**

```bash
rm apps/web/src/components/globe/ExchangeLabels.tsx
rm apps/web/src/components/globe/StockMarketLabels.tsx
rm apps/web/src/components/globe/WorldCapitals.tsx
rm apps/web/src/components/globe/EconomicOverlay.tsx
rm apps/web/src/components/globe/StrategicStraits.tsx
```

- [ ] **Step 2: Видалити UI panels**

```bash
rm apps/web/src/components/panels/WhaleTicker.tsx
rm apps/web/src/components/panels/SeasonWidget.tsx
rm apps/web/src/components/panels/SessionVolumeBars.tsx
rm apps/web/src/components/panels/AltcoinSeasonBadge.tsx
rm apps/web/src/components/panels/PriceSparklines.tsx
rm apps/web/src/components/panels/PriceAlertsPanel.tsx
rm apps/web/src/components/panels/CleanUI.tsx
rm apps/web/src/components/panels/TerminalUI.tsx
rm apps/web/src/components/panels/GlobeModeBar.tsx
```

- [ ] **Step 3: Видалити API routes**

```bash
rm apps/web/src/app/api/corr/route.ts
rm apps/web/src/app/api/exchanges/route.ts
rm apps/web/src/app/api/stocks/route.ts
# Видалити порожні директорії
rmdir apps/web/src/app/api/corr apps/web/src/app/api/exchanges apps/web/src/app/api/stocks 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ apps/web/src/app/api/
git commit -m "refactor: delete crypto components and API routes"
```

---

## Task 7: Спростити сервер (видалити WS + connectors)

**Files:**
- Delete: `apps/server/src/connectors/` (8 файлів), `apps/server/src/ws/broadcaster.ts`, `apps/server/src/services/PriceService.ts`, `apps/server/src/services/WhaleService.ts`, `apps/server/src/services/__tests__/WhaleService.test.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/.env.example`

**Interfaces:**
- Produces: сервер виконує тільки `GET /api/health`, слухає на PORT (default 4000)

- [ ] **Step 1: Видалити connector і service файли**

```bash
rm apps/server/src/connectors/BinanceConnector.ts
rm apps/server/src/connectors/CoinGeckoConnector.ts
rm apps/server/src/connectors/CommodityConnector.ts
rm apps/server/src/connectors/EthGasConnector.ts
rm apps/server/src/connectors/FundingConnector.ts
rm apps/server/src/connectors/KrakenConnector.ts
rm apps/server/src/connectors/LiquidationsConnector.ts
rm apps/server/src/connectors/WhaleConnector.ts
rm apps/server/src/ws/broadcaster.ts
rm apps/server/src/services/PriceService.ts
rm apps/server/src/services/WhaleService.ts
rm apps/server/src/services/__tests__/WhaleService.test.ts
rmdir apps/server/src/connectors apps/server/src/ws 2>/dev/null || true
```

- [ ] **Step 2: Замінити apps/server/src/index.ts**

```typescript
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { healthRouter } from "./routes/health.js";

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

app.listen(PORT, () => {
  console.log(`[ipmap-server] http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Оновити apps/server/.env.example**

Залишити тільки:
```
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
NODE_ENV=development
```

Видалити рядки з `BINANCE_WS_URL`, `COINGECKO_API_URL`, `NEXT_PUBLIC_WS_URL`.

- [ ] **Step 4: Перевірити compile сервера**

```bash
pnpm --filter @ipmap/server type-check
```

Очікувано: 0 помилок.

- [ ] **Step 5: Commit**

```bash
git add apps/server/
git commit -m "refactor(server): remove WS broadcaster and crypto connectors"
```

---

## Task 8: Видалити whale arcs і exchange markers з useGlobe.ts

**Files:**
- Modify: `apps/web/src/hooks/useGlobe.ts`

**Interfaces:**
- Consumes: `TWEAK_DEFAULTS` з `@/lib/constants`; `getSunLatLng` з `@/lib/sun`
- Produces: `useGlobe(canvasRef, { mode, tweaks })` — глобус без крипто-маркерів

- [ ] **Step 1: Виправити імпорти на початку useGlobe.ts**

Рядки 1–6 замінити на:

```typescript
"use client";

import { TWEAK_DEFAULTS } from "@/lib/constants";
import { getSunLatLng } from "@/lib/sun";
import type { GlobeMode, TweakValues } from "@ipmap/types";
import { useEffect, useRef } from "react";
import * as THREE from "three";
```

- [ ] **Step 2: Очистити window global declarations**

Знайти блок `declare global { interface Window { ... } }` (приблизно рядки 41–60). Видалити з нього:
- `globeProject?`, `exchangeData?`, `globeState?`, `globeCamDist?`, `globeLayerGroups?`, `timeOffsetHours?`, `tweakPulse?`, `onWhaleArc?`

Залишити тільки (якщо є) `globeProject` для майбутнього використання у React overlay. Якщо `globeProject` не використовується після видалення компонентів — видалити і його.

Зрештою блок може виглядати так (або видалити повністю якщо нічого не треба):

```typescript
declare global {
  interface Window {
    globeProject?: (lat: number, lng: number) => { x: number; y: number; visible: boolean };
    globeState?: { setMode: (m: GlobeMode) => void; mode: GlobeMode };
    globeCamDist?: number;
    globeLayerGroups?: Record<string, { visible: boolean }>;
  }
}
```

- [ ] **Step 3: Видалити onWhaleArc з UseGlobeOptions**

Знайти інтерфейс `UseGlobeOptions` (~рядок 181) і видалити:
```typescript
onWhaleArc?: (w: {
  type: string;
  amount: number;
  from: string;
  to: string;
}) => void;
```

Результат:
```typescript
export interface UseGlobeOptions {
  mode: GlobeMode;
  tweaks: TweakValues;
}
```

- [ ] **Step 4: Видалити whale arc систему**

Знайти і видалити весь блок `// ── Whale arc system ──` (≈ рядки 1079–1224 оригінального файлу). Включає:
- `interface ArcEntry { ... }`
- `const WHALE_COLORS: Record<...> = { ... }`
- `const whaleGroup = new THREE.Group()`
- `scene.add(whaleGroup)`
- `const activeArcs: ArcEntry[] = []`
- `function spawnWhaleArc(...) { ... }` (вся функція)
- `function updateWhaleArcs() { ... }` (вся функція)
- `window.onWhaleArc = (w) => spawnWhaleArc(w);`

- [ ] **Step 5: Видалити exchange markers**

Знайти і видалити блок `// ── Exchange markers (flat billboards) ──` (≈ рядки 1232–1266). Включає:
- `const markerGroup = new THREE.Group()`
- `scene.add(markerGroup)`
- `const markerMeshes: { dot, ring, phase, ex }[] = []`
- `EXCHANGES.forEach((ex) => { ... })` повністю
- Рядок `window.exchangeData = EXCHANGES;`

- [ ] **Step 6: Видалити stock market markers**

Знайти і видалити блок `// ── Stock market diamond markers ──` (≈ рядки 1269–1290). Включає:
- `const stockGroup = new THREE.Group()`
- `scene.add(stockGroup)`
- `const stockMeshes: { mesh }[] = []`
- `STOCK_MARKETS.forEach(...)` повністю

- [ ] **Step 7: Видалити оновлення маркерів в animate()**

В функції `animate()` знайти і видалити:
```typescript
// Видалити блок оновлення markerMeshes (~рядки 1340–1354):
markerMeshes.forEach((m) => {
  m.dot.quaternion.copy(camera.quaternion);
  // ...
});

// Видалити блок оновлення stockMeshes (~рядки 1355–1358):
stockMeshes.forEach((m) => {
  m.mesh.quaternion.copy(camera.quaternion);
});

// Видалити auto-spawn arcs (~рядки 1374–1381):
nextSpawn -= dt;
if (nextSpawn <= 0) {
  spawnWhaleArc();
  nextSpawn = 3 + Math.random() * 4;
}
updateWhaleArcs();
```

Також видалити `let nextSpawn = 3;` (~рядок 1229).

- [ ] **Step 8: Видалити delete window.onWhaleArc з cleanup**

В cleanup-секції (return функція в useEffect) видалити рядок:
```typescript
delete window.onWhaleArc;
```

- [ ] **Step 9: Перевірити що глобус рендериться**

```bash
pnpm --filter @ipmap/web dev
```

Відкрити http://localhost:3000 — глобус повинен обертатися. Помилок в консолі браузера не повинно бути (крім можливих помилок 404 якщо page.tsx ще імпортує видалені компоненти).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/hooks/useGlobe.ts
git commit -m "refactor(globe): remove whale arcs and exchange markers"
```

---

## Task 9: Спростити page.tsx і GlobeScene.tsx

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Modify: `apps/web/src/components/globe/GlobeScene.tsx`
- Modify: `apps/web/src/components/panels/TweaksPanel.tsx` — перевірити імпорти, можливо потребує оновлення

**Interfaces:**
- Consumes: `AppProvider`, `useAppContext`, `useGlobe`
- Produces: працюючий глобус з TweaksPanel, без крипто-UI

- [ ] **Step 1: Замінити page.tsx**

```typescript
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

function IpMapApp() {
  const { state, dispatch } = useAppContext();
  const { globeMode, tweaks } = state;

  const onGlobeModeChange = (mode: GlobeMode) => {
    dispatch({ type: "SET_GLOBE_MODE", payload: mode });
    if (typeof window !== "undefined") {
      window.globeState?.setMode(mode);
    }
  };

  return (
    <>
      <LoadingBar />
      <GlobeScene mode={globeMode} tweaks={tweaks} />
      <TweaksPanel />
    </>
  );
}

export default function HomePage() {
  return (
    <AppProvider>
      <IpMapApp />
    </AppProvider>
  );
}
```

- [ ] **Step 2: Оновити GlobeScene.tsx**

```typescript
'use client'

import { useRef, memo } from 'react'
import { useGlobe } from '@/hooks/useGlobe'
import type { GlobeMode, TweakValues } from '@ipmap/types'

interface GlobeSceneProps {
  mode: GlobeMode
  tweaks: TweakValues
}

export const GlobeScene = memo(function GlobeScene({ mode, tweaks }: GlobeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGlobe(canvasRef, { mode, tweaks })

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
      }}
    />
  )
})
```

- [ ] **Step 3: Перевірити TweaksPanel.tsx**

```bash
grep -n "sessionmap\|PriceAlert\|WhaleEvent\|wsStatus" apps/web/src/components/panels/TweaksPanel.tsx
```

Якщо знайдені старі посилання — видалити їх. TweaksPanel керує тільки `TweakValues` через dispatch `SET_TWEAK`, що залишилось.

- [ ] **Step 4: Запустити і перевірити в браузері**

```bash
pnpm --filter @ipmap/web dev
```

Очікувано: http://localhost:3000 показує глобус, обертається, шейдер день/ніч працює, клавіша E відкриває TweaksPanel.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/ apps/web/src/components/globe/GlobeScene.tsx
git commit -m "refactor(page): simplify to bare globe + TweaksPanel"
```

---

## Task 10: ETL-скрипт — генерація ipv4-by-country.json і centroids.json

**Files:**
- Create: `scripts/build-ipv4-data.mjs`

**Interfaces:**
- Produces:
  - `apps/web/public/data/ipv4-by-country.json` → `{ byCountry: Record<string,number>, blocksByCountry: Record<string,Array<{start:string,size:number}>> }`
  - `apps/web/public/data/centroids.json` → `Record<string, { lat:number, lng:number, name:string }>`

- [ ] **Step 1: Написати ETL-скрипт**

Створити `scripts/build-ipv4-data.mjs`:

```javascript
#!/usr/bin/env node
// ETL: завантажує 5 RIR delegated files → ipv4-by-country.json + centroids.json

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '../apps/web/public/data')

const RIR_URLS = [
  'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest',
  'https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest',
  'https://ftp.apnic.net/pub/stats/apnic/delegated-apnic-latest',
  'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest',
  'https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest',
]

const CENTROIDS_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson'

// ── RIR parsing ───────────────────────────────────────────────────────────────

function parseRIR(text) {
  /** @type {Record<string,number>} */
  const byCountry = {}
  /** @type {Record<string,Array<{start:string,size:number}>>} */
  const blocksByCountry = {}

  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const parts = line.split('|')
    if (parts.length < 7) continue
    const [, cc, type, start, value, , status] = parts
    if (type !== 'ipv4') continue
    if (!cc || cc === '*') continue
    if (status !== 'allocated' && status !== 'assigned') continue
    const size = parseInt(value, 10)
    if (!size || isNaN(size)) continue

    byCountry[cc] = (byCountry[cc] ?? 0) + size
    if (!blocksByCountry[cc]) blocksByCountry[cc] = []
    blocksByCountry[cc].push({ start, size })
  }

  return { byCountry, blocksByCountry }
}

// ── IP to BigInt (для сортування блоків) ─────────────────────────────────────

function ipToBigInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8n) | BigInt(octet), 0n)
}

// ── Centroids з Natural Earth ─────────────────────────────────────────────────

async function buildCentroids() {
  console.log('  Fetching centroids from Natural Earth...')
  const res = await fetch(CENTROIDS_URL)
  if (!res.ok) throw new Error(`Centroids fetch failed: ${res.status}`)
  const geo = await res.json()
  /** @type {Record<string,{lat:number,lng:number,name:string}>} */
  const centroids = {}
  for (const feature of geo.features) {
    const p = feature.properties
    const cc = p.ISO_A2
    if (!cc || cc === '-1' || cc === '') continue
    centroids[cc] = {
      lat: p.LABEL_Y ?? p.LAT ?? 0,
      lng: p.LABEL_X ?? p.LON ?? 0,
      name: p.NAME_EN ?? p.NAME ?? cc,
    }
  }
  return centroids
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  /** @type {Record<string,number>} */
  const byCountry = {}
  /** @type {Record<string,Array<{start:string,size:number}>>} */
  const blocksByCountry = {}

  console.log('Fetching RIR data...')
  for (const url of RIR_URLS) {
    const label = url.split('/').at(-1)
    process.stdout.write(`  ${label}... `)
    try {
      const res = await fetch(url)
      if (!res.ok) { console.log(`SKIP (${res.status})`); continue }
      const text = await res.text()
      const { byCountry: bc, blocksByCountry: bbc } = parseRIR(text)

      for (const [cc, count] of Object.entries(bc)) {
        byCountry[cc] = (byCountry[cc] ?? 0) + count
      }
      for (const [cc, blocks] of Object.entries(bbc)) {
        if (!blocksByCountry[cc]) blocksByCountry[cc] = []
        blocksByCountry[cc].push(...blocks)
      }
      const total = Object.values(bc).reduce((a, b) => a + b, 0)
      console.log(`OK (${Object.keys(bc).length} countries, ${(total / 1e6).toFixed(1)}M IPs)`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }
  }

  // Сортуємо блоки кожної країни за стартовою IP (BigInt)
  for (const cc of Object.keys(blocksByCountry)) {
    blocksByCountry[cc].sort((a, b) => {
      const ai = ipToBigInt(a.start)
      const bi = ipToBigInt(b.start)
      return ai < bi ? -1 : ai > bi ? 1 : 0
    })
  }

  const ipv4Path = path.join(OUT_DIR, 'ipv4-by-country.json')
  await writeFile(ipv4Path, JSON.stringify({ byCountry, blocksByCountry }))
  const totalIPs = Object.values(byCountry).reduce((a, b) => a + b, 0)
  console.log(
    `\nWritten: ${ipv4Path}` +
    `\n  ${Object.keys(byCountry).length} countries, ${(totalIPs / 1e9).toFixed(2)}B IPs total`
  )

  const centroids = await buildCentroids()
  const centroidsPath = path.join(OUT_DIR, 'centroids.json')
  await writeFile(centroidsPath, JSON.stringify(centroids))
  console.log(`Written: ${centroidsPath} (${Object.keys(centroids).length} entries)`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Запустити скрипт**

```bash
node scripts/build-ipv4-data.mjs
```

Очікуваний вивід:
```
Fetching RIR data...
  delegated-ripencc-latest... OK (XX countries, XXX.XM IPs)
  delegated-arin-extended-latest... OK (...)
  ...
Written: apps/web/public/data/ipv4-by-country.json
  XX countries, X.XXB IPs total
Written: apps/web/public/data/centroids.json (XXX entries)
```

- [ ] **Step 3: Перевірити вихідні файли**

```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('apps/web/public/data/ipv4-by-country.json'))
console.log('US IPs:', d.byCountry.US.toLocaleString())
console.log('UA IPs:', d.byCountry.UA.toLocaleString())
console.log('UA blocks:', d.blocksByCountry.UA.length)
console.log('First UA block:', JSON.stringify(d.blocksByCountry.UA[0]))
"
```

Очікувано: US ~ 1 600 000 000, UA ~ 10 000 000+, перший блок UA відсортований за IP.

```bash
node -e "
const c = JSON.parse(require('fs').readFileSync('apps/web/public/data/centroids.json'))
console.log('US:', JSON.stringify(c.US))
console.log('UA:', JSON.stringify(c.UA))
"
```

Очікувано: `US: {"lat":38.7,"lng":-97.4,"name":"United States"}` (приблизно).

- [ ] **Step 4: Додати згенеровані файли в .gitignore або закомітити**

Ці файли великі (~10-50 MB) і генеруються скриптом. Краще НЕ комітити в git, а генерувати в CI або локально. Додати до `.gitignore`:

```bash
echo "apps/web/public/data/ipv4-by-country.json" >> .gitignore
echo "apps/web/public/data/centroids.json" >> .gitignore
```

- [ ] **Step 5: Commit скрипту**

```bash
git add scripts/build-ipv4-data.mjs .gitignore
git commit -m "feat: add ETL script build-ipv4-data.mjs for RIR → JSON"
```

---

## Task 11: useIpData hook і тест парсингу

**Files:**
- Create: `apps/web/src/hooks/useIpData.ts`
- Create: `apps/web/src/hooks/__tests__/useIpData.test.ts`

**Interfaces:**
- Consumes: `CountryAlloc, IpBlock` з `@ipmap/types`; `fetch('/data/ipv4-by-country.json')` і `fetch('/data/centroids.json')`
- Produces: `useIpData(): { countries: CountryAlloc[], blocksByCountry: Record<string, IpBlock[]>, isLoading: boolean, error: string | null }`

- [ ] **Step 1: Написати тест парсингу (TDD)**

Створити `apps/web/src/hooks/__tests__/useIpData.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseIpData } from '../useIpData'

describe('parseIpData', () => {
  it('об'єднує byCountry і centroids у CountryAlloc[]', () => {
    const ipv4 = {
      byCountry: { UA: 10000000, US: 1600000000 },
      blocksByCountry: {
        UA: [{ start: '193.108.0.0', size: 8192 }],
        US: [],
      },
    }
    const centroids = {
      UA: { lat: 48.4, lng: 31.2, name: 'Ukraine' },
      US: { lat: 38.7, lng: -97.4, name: 'United States' },
    }

    const result = parseIpData(ipv4, centroids)

    expect(result).toHaveLength(2)
    const ua = result.find(c => c.cc === 'UA')!
    expect(ua.ipCount).toBe(10000000)
    expect(ua.lat).toBe(48.4)
    expect(ua.lng).toBe(31.2)
    expect(ua.name).toBe('Ukraine')
  })

  it('пропускає країни без центроїда', () => {
    const ipv4 = {
      byCountry: { UA: 10000000, XX: 1000 },
      blocksByCountry: { UA: [], XX: [] },
    }
    const centroids = { UA: { lat: 48.4, lng: 31.2, name: 'Ukraine' } }

    const result = parseIpData(ipv4, centroids)
    expect(result).toHaveLength(1)
    expect(result[0].cc).toBe('UA')
  })
})
```

- [ ] **Step 2: Запустити тест — переконатись що FAIL**

```bash
pnpm --filter @ipmap/web test
```

Очікувано: FAIL з `Cannot find module '../useIpData'`

- [ ] **Step 3: Написати useIpData.ts**

Створити `apps/web/src/hooks/useIpData.ts`:

```typescript
import { useState, useEffect } from 'react'
import type { CountryAlloc, IpBlock } from '@ipmap/types'

interface RawIpData {
  byCountry: Record<string, number>
  blocksByCountry: Record<string, IpBlock[]>
}

interface RawCentroids {
  [cc: string]: { lat: number; lng: number; name: string }
}

export function parseIpData(ipv4: RawIpData, centroids: RawCentroids): CountryAlloc[] {
  const countries: CountryAlloc[] = []
  for (const [cc, ipCount] of Object.entries(ipv4.byCountry)) {
    const c = centroids[cc]
    if (!c) continue
    countries.push({ cc, name: c.name, ipCount, lat: c.lat, lng: c.lng })
  }
  return countries
}

export interface IpDataResult {
  countries: CountryAlloc[]
  blocksByCountry: Record<string, IpBlock[]>
  isLoading: boolean
  error: string | null
}

export function useIpData(): IpDataResult {
  const [result, setResult] = useState<IpDataResult>({
    countries: [],
    blocksByCountry: {},
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    Promise.all([
      fetch('/data/ipv4-by-country.json').then(r => {
        if (!r.ok) throw new Error(`ipv4 data: ${r.status}`)
        return r.json() as Promise<RawIpData>
      }),
      fetch('/data/centroids.json').then(r => {
        if (!r.ok) throw new Error(`centroids: ${r.status}`)
        return r.json() as Promise<RawCentroids>
      }),
    ])
      .then(([ipv4, centroids]) => {
        setResult({
          countries: parseIpData(ipv4, centroids),
          blocksByCountry: ipv4.blocksByCountry,
          isLoading: false,
          error: null,
        })
      })
      .catch((err: Error) => {
        setResult(prev => ({ ...prev, isLoading: false, error: err.message }))
      })
  }, [])

  return result
}
```

- [ ] **Step 4: Запустити тести — переконатись що PASS**

```bash
pnpm --filter @ipmap/web test
```

Очікувано: 2 тести PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useIpData.ts apps/web/src/hooks/__tests__/
git commit -m "feat: add useIpData hook with parseIpData unit tests"
```

---

## Task 12: World level — country markers і raycasting

**Files:**
- Modify: `apps/web/src/hooks/useGlobe.ts`
- Modify: `apps/web/src/components/globe/GlobeScene.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `CountryAlloc[]` від `useIpData`
- Produces: глобус з кольоровими маркерами на кожну країну; клік → `onCountryClick(cc)`

- [ ] **Step 1: Розширити UseGlobeOptions**

В `useGlobe.ts` оновити інтерфейс:

```typescript
import type { GlobeMode, TweakValues, CountryAlloc } from "@ipmap/types";

export interface UseGlobeOptions {
  mode: GlobeMode;
  tweaks: TweakValues;
  countries?: CountryAlloc[];
  onCountryClick?: (cc: string) => void;
}
```

- [ ] **Step 2: Додати country markers в useGlobe.ts**

В функції `(async () => { ... })()` всередині useEffect, після секції `// ── Exchange markers` (яку ми видалили), додати country-маркери та raycasting. Вставити цей блок перед `// ── Animation loop`:

```typescript
// ── Country markers ───────────────────────────────────────────────────────────
const countryGroup = new THREE.Group();
scene.add(countryGroup);

interface CountryMeshEntry {
  dot: THREE.Mesh;
  ring: THREE.Mesh;
  cc: string;
}
const countryMeshes: CountryMeshEntry[] = [];

function buildCountryMarkers(countries: CountryAlloc[]) {
  // Очистити попередні маркери
  for (const entry of countryMeshes) {
    countryGroup.remove(entry.dot, entry.ring);
    entry.dot.geometry.dispose();
    entry.ring.geometry.dispose();
    (entry.dot.material as THREE.Material).dispose();
    (entry.ring.material as THREE.Material).dispose();
  }
  countryMeshes.length = 0;

  if (!countries.length) return;

  const maxLog = Math.log10(Math.max(...countries.map(c => c.ipCount)));

  for (const country of countries) {
    const pos = latLngToVec3(country.lat, country.lng, 1.015);
    const logRatio = Math.log10(Math.max(country.ipCount, 1)) / maxLog; // 0..1
    const r = 0.005 + logRatio * 0.018;

    // Колір: холодний синій (мало) → теплий жовтогарячий (багато)
    const col = new THREE.Color().setHSL(0.6 - logRatio * 0.55, 0.9, 0.55);

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(r, 16),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
    );
    dot.position.copy(pos);
    dot.userData.cc = country.cc;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.6, r * 2.2, 24),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.position.copy(pos);

    countryGroup.add(dot, ring);
    countryMeshes.push({ dot, ring, cc: country.cc });
  }
}

// Збудувати маркери якщо дані вже є при ініціалізації
if (optionsRef.current.countries?.length) {
  buildCountryMarkers(optionsRef.current.countries);
}

// ── Raycasting click ──────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const onCanvasClick = (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);
  const dots = countryMeshes.map(m => m.dot);
  const hits = raycaster.intersectObjects(dots);
  if (hits.length > 0) {
    const cc = hits[0].object.userData.cc as string;
    optionsRef.current.onCountryClick?.(cc);
  }
};
canvas.addEventListener('click', onCanvasClick);
```

- [ ] **Step 3: Оновити маркери при зміні countries в animate або useEffect**

Додати в animate після `controls.update()`:

```typescript
// Rebuild country markers if data changed
const newCountries = optionsRef.current.countries;
if (newCountries !== lastCountriesRef.current) {
  lastCountriesRef.current = newCountries;
  if (newCountries) buildCountryMarkers(newCountries);
}
```

Додати декларацію перед animate():
```typescript
let lastCountriesRef = { current: undefined as CountryAlloc[] | undefined };
```

- [ ] **Step 4: Оновити billboard для country rings в animate()**

В animate(), після оновлення controls, додати:
```typescript
// Маркери завжди дивляться на камеру (billboard)
for (const m of countryMeshes) {
  m.dot.quaternion.copy(camera.quaternion);
  m.ring.quaternion.copy(camera.quaternion);
  if (tweaks.markerPulse) {
    const s = 1 + 0.4 * Math.sin(elapsed * 1.2);
    m.ring.scale.setScalar(s);
    (m.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 * (2 - s) * 0.5;
  } else {
    (m.ring.material as THREE.MeshBasicMaterial).opacity = 0;
  }
}
```

- [ ] **Step 5: Видалити onCanvasClick з cleanup**

В cleanup-функції (return всередині useEffect) додати:
```typescript
canvas.removeEventListener('click', onCanvasClick);
```

- [ ] **Step 6: Оновити GlobeScene.tsx — передати countries та callback**

```typescript
'use client'

import { useRef, memo } from 'react'
import { useGlobe } from '@/hooks/useGlobe'
import type { GlobeMode, TweakValues, CountryAlloc } from '@ipmap/types'

interface GlobeSceneProps {
  mode: GlobeMode
  tweaks: TweakValues
  countries?: CountryAlloc[]
  onCountryClick?: (cc: string) => void
}

export const GlobeScene = memo(function GlobeScene({ mode, tweaks, countries, onCountryClick }: GlobeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGlobe(canvasRef, { mode, tweaks, countries, onCountryClick })

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, display: 'block' }}
    />
  )
})
```

- [ ] **Step 7: Підключити useIpData в page.tsx**

```typescript
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";
import { useIpData } from "@/hooks/useIpData";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

function IpMapApp() {
  const { state, dispatch } = useAppContext();
  const { globeMode, tweaks } = state;
  const { countries, isLoading } = useIpData();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const onGlobeModeChange = (mode: GlobeMode) => {
    dispatch({ type: "SET_GLOBE_MODE", payload: mode });
    window.globeState?.setMode(mode);
  };

  return (
    <>
      <LoadingBar />
      <GlobeScene
        mode={globeMode}
        tweaks={tweaks}
        countries={countries}
        onCountryClick={setSelectedCountry}
      />
      {isLoading && (
        <div style={{ position: 'fixed', top: 16, left: 16, color: '#aaa', fontSize: 12, zIndex: 20 }}>
          Завантаження IP-даних...
        </div>
      )}
      <TweaksPanel />
    </>
  );
}

export default function HomePage() {
  return (
    <AppProvider>
      <IpMapApp />
    </AppProvider>
  );
}
```

- [ ] **Step 8: Запустити і перевірити в браузері**

```bash
node scripts/build-ipv4-data.mjs   # якщо ще не зроблено
pnpm --filter @ipmap/web dev
```

Очікувано: глобус з кольоровими крапками на кожну країну, розмір ∝ log(ipCount). США — велика жовтогаряча крапка. Клік по крапці → `selectedCountry` встановлюється (перевірити через console.log у onCountryClick).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/hooks/useGlobe.ts apps/web/src/components/globe/GlobeScene.tsx apps/web/src/app/(dashboard)/page.tsx
git commit -m "feat: world-level country markers with raycasting click"
```

---

## Task 13: Country level — block cluster + camera tween

**Files:**
- Modify: `apps/web/src/hooks/useGlobe.ts`
- Modify: `apps/web/src/components/globe/GlobeScene.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Create: `apps/web/src/components/panels/CountryPanel.tsx`

**Interfaces:**
- Consumes: `IpBlock[]` для обраної країни; centroid з `CountryAlloc`
- Produces: при `selectedCountry !== null` — country-маркери приховані, block-кластер видно; клік по блоку → `onBlockClick(block)`; кнопка Назад → `selectedCountry = null`

- [ ] **Step 1: Розширити UseGlobeOptions і GlobeSceneProps**

В `useGlobe.ts`:

```typescript
import type { GlobeMode, TweakValues, CountryAlloc, IpBlock } from "@ipmap/types";

export interface UseGlobeOptions {
  mode: GlobeMode;
  tweaks: TweakValues;
  countries?: CountryAlloc[];
  selectedCountry?: string | null;  // cc або null = world level
  countryData?: CountryAlloc | null;  // дані обраної країни (lat/lng для tween)
  countryBlocks?: IpBlock[];          // відсортовані блоки обраної країни
  onCountryClick?: (cc: string) => void;
  onBlockClick?: (block: IpBlock) => void;
}
```

В `GlobeScene.tsx` додати ті самі поля до `GlobeSceneProps`.

- [ ] **Step 2: Додати camera tween в useGlobe.ts**

Перед `animate()` оголосити стан tweening:

```typescript
let camTarget: THREE.Vector3 | null = null;
let camFrom: THREE.Vector3 | null = null;
let camTweenT = 1.0;

function tweenCameraTo(lat: number, lng: number, dist = 2.2) {
  camFrom = camera.position.clone();
  camTarget = latLngToVec3(lat, lng).multiplyScalar(dist);
  camTweenT = 0;
  controls.autoRotate = false;
}
```

В `animate()` перед `controls.update()` додати:

```typescript
if (camTweenT < 1.0 && camTarget && camFrom) {
  camTweenT = Math.min(1.0, camTweenT + dt * 1.0);
  const ease = 1 - Math.pow(1 - camTweenT, 3); // cubic ease-out
  camera.position.lerpVectors(camFrom, camTarget, ease);
}
```

- [ ] **Step 3: Додати block cluster rendering в useGlobe.ts**

Після `countryGroup` оголосити:

```typescript
const blockGroup = new THREE.Group();
scene.add(blockGroup);
let blockPoints: THREE.Points | null = null;
let blockEntries: IpBlock[] = [];

function buildBlockCluster(blocks: IpBlock[], centerLat: number, centerLng: number) {
  if (blockPoints) {
    blockGroup.remove(blockPoints);
    blockPoints.geometry.dispose();
    (blockPoints.material as THREE.Material).dispose();
    blockPoints = null;
  }
  blockEntries = blocks;
  if (!blocks.length) return;

  const cols = Math.ceil(Math.sqrt(blocks.length));
  const step = 0.6; // degrees between blocks
  const positions: number[] = [];

  blocks.forEach((block, i) => {
    const row = Math.floor(i / cols) - Math.floor(cols / 2);
    const col = (i % cols) - Math.floor(cols / 2);
    const lat = centerLat + row * step;
    const lng = centerLng + col * step;
    const v = latLngToVec3(lat, lng, 1.015);
    positions.push(v.x, v.y, v.z);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.012,
    color: 0x60a5fa,
    sizeAttenuation: true,
  });
  blockPoints = new THREE.Points(geo, mat);
  blockGroup.add(blockPoints);
}

function clearBlockCluster() {
  if (blockPoints) {
    blockGroup.remove(blockPoints);
    blockPoints.geometry.dispose();
    (blockPoints.material as THREE.Material).dispose();
    blockPoints = null;
  }
  blockEntries = [];
}
```

- [ ] **Step 4: Реагувати на зміну selectedCountry в animate()**

Додати в animate() відстеження зміни `selectedCountry`:

```typescript
const newSelected = optionsRef.current.selectedCountry;
const newBlocks = optionsRef.current.countryBlocks;
const newCountryData = optionsRef.current.countryData;

if (newSelected !== lastSelectedRef.current) {
  lastSelectedRef.current = newSelected;
  if (newSelected && newCountryData) {
    // Перейти на рівень країни
    countryGroup.visible = false;
    tweenCameraTo(newCountryData.lat, newCountryData.lng);
    buildBlockCluster(newBlocks ?? [], newCountryData.lat, newCountryData.lng);
  } else {
    // Повернутись на рівень світу
    countryGroup.visible = true;
    clearBlockCluster();
    controls.autoRotate = optionsRef.current.mode === 'auto';
  }
}
```

Додати перед animate():
```typescript
let lastSelectedRef = { current: undefined as string | null | undefined };
```

- [ ] **Step 5: Raycasting для block click**

В обробник `onCanvasClick` додати перевірку блоків (після перевірки country markers):

```typescript
const onCanvasClick = (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);

  // Рівень Країна: клік по блоку
  if (blockPoints) {
    raycaster.params.Points = { threshold: 0.015 };
    const blockHits = raycaster.intersectObject(blockPoints);
    if (blockHits.length > 0) {
      const idx = blockHits[0].index ?? 0;
      if (blockEntries[idx]) {
        optionsRef.current.onBlockClick?.(blockEntries[idx]);
      }
      return;
    }
  }

  // Рівень Світ: клік по country marker
  if (countryGroup.visible) {
    const dots = countryMeshes.map(m => m.dot);
    const hits = raycaster.intersectObjects(dots);
    if (hits.length > 0) {
      const cc = hits[0].object.userData.cc as string;
      optionsRef.current.onCountryClick?.(cc);
    }
  }
};
```

- [ ] **Step 6: Створити CountryPanel.tsx**

Створити `apps/web/src/components/panels/CountryPanel.tsx`:

```typescript
'use client'

import type { CountryAlloc } from '@ipmap/types'

function formatIPs(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} млрд`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} млн`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} тис`
  return String(n)
}

interface CountryPanelProps {
  country: CountryAlloc
  blockCount: number
  onBack: () => void
}

export function CountryPanel({ country, blockCount, onBack }: CountryPanelProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 50,
        background: 'rgba(0,0,0,0.75)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '12px 16px',
        color: '#fff',
        fontFamily: 'monospace',
        minWidth: 240,
        pointerEvents: 'all',
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#60a5fa',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 8,
          fontSize: 13,
        }}
      >
        ← Назад до світу
      </button>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        {country.name} ({country.cc})
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>
        IPv4-адрес: <span style={{ color: '#f8fafc' }}>{formatIPs(country.ipCount)}</span>
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>
        Блоків: <span style={{ color: '#f8fafc' }}>{blockCount.toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
        Клікніть по блоку для RDAP інфо
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Підключити CountryPanel в page.tsx**

```typescript
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode, IpBlock } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";
import { CountryPanel } from "@/components/panels/CountryPanel";
import { useIpData } from "@/hooks/useIpData";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

function IpMapApp() {
  const { state, dispatch } = useAppContext();
  const { globeMode, tweaks } = state;
  const { countries, blocksByCountry, isLoading } = useIpData();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<IpBlock | null>(null);

  const countryData = selectedCountry
    ? countries.find(c => c.cc === selectedCountry) ?? null
    : null;
  const countryBlocks = selectedCountry ? (blocksByCountry[selectedCountry] ?? []) : [];

  const handleBack = () => {
    setSelectedCountry(null);
    setSelectedBlock(null);
  };

  return (
    <>
      <LoadingBar />
      <GlobeScene
        mode={globeMode}
        tweaks={tweaks}
        countries={countries}
        selectedCountry={selectedCountry}
        countryData={countryData}
        countryBlocks={countryBlocks}
        onCountryClick={setSelectedCountry}
        onBlockClick={setSelectedBlock}
      />
      {isLoading && (
        <div style={{ position: 'fixed', top: 16, left: 16, color: '#aaa', fontSize: 12, zIndex: 20 }}>
          Завантаження IP-даних...
        </div>
      )}
      {countryData && (
        <CountryPanel
          country={countryData}
          blockCount={countryBlocks.length}
          onBack={handleBack}
        />
      )}
      <TweaksPanel />
    </>
  );
}

export default function HomePage() {
  return (
    <AppProvider>
      <IpMapApp />
    </AppProvider>
  );
}
```

- [ ] **Step 8: Перевірити в браузері**

```bash
pnpm --filter @ipmap/web dev
```

Очікувано:
- Клік по крапці країни → CountryPanel з'являється, камера злітає до країни, видно сітку синіх точок (блоків)
- Кнопка «Назад» → повернення до world level, маркери країн знову видно
- Клік по синій точці блоку → `selectedBlock` встановлюється (console.log для перевірки)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/hooks/useGlobe.ts apps/web/src/components/ apps/web/src/app/
git commit -m "feat: country drill-down with block cluster and camera tween"
```

---

## Task 14: Block level — RDAP on-demand + BlockPanel

**Files:**
- Create: `apps/web/src/lib/rdap.ts`
- Create: `apps/web/src/lib/__tests__/rdap.test.ts`
- Create: `apps/web/src/components/panels/BlockPanel.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `IpBlock.start` — IP для RDAP-запиту
- Produces: `fetchRdap(ip: string): Promise<RdapInfo | null>` з кешем; `BlockPanel` відображає назву орг., AS, дату виділення, abuse email

- [ ] **Step 1: Написати тест rdap (mock fetch)**

Створити `apps/web/src/lib/__tests__/rdap.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRdap, extractRdapInfo } from '../rdap'

describe('extractRdapInfo', () => {
  it('витягує назву і дату з RDAP відповіді', () => {
    const raw = {
      name: 'UA-NREN-1',
      handle: '193.108.0.0 - 193.108.31.255',
      startAddress: '193.108.0.0',
      endAddress: '193.108.31.255',
      ipVersion: 'v4',
      entities: [
        {
          vcardArray: ['vcard', [
            ['fn', {}, 'text', 'URAN Association'],
          ]],
          roles: ['registrant'],
          entities: [
            {
              vcardArray: ['vcard', [
                ['email', {}, 'text', 'abuse@uran.ua'],
              ]],
              roles: ['abuse'],
            },
          ],
        },
      ],
      events: [
        { eventAction: 'registration', eventDate: '2012-01-01T00:00:00Z' },
        { eventAction: 'last changed', eventDate: '2020-05-15T00:00:00Z' },
      ],
    }

    const info = extractRdapInfo(raw)
    expect(info.name).toBe('UA-NREN-1')
    expect(info.orgName).toBe('URAN Association')
    expect(info.abuseEmail).toBe('abuse@uran.ua')
    expect(info.registrationDate).toBe('2012-01-01T00:00:00Z')
  })
})
```

- [ ] **Step 2: Запустити тест — FAIL**

```bash
pnpm --filter @ipmap/web test
```

Очікувано: FAIL з `Cannot find module '../rdap'`

- [ ] **Step 3: Написати rdap.ts**

Створити `apps/web/src/lib/rdap.ts`:

```typescript
export interface RdapInfo {
  name: string
  orgName: string | null
  abuseEmail: string | null
  registrationDate: string | null
  startAddress: string
  endAddress: string
  ipVersion: string
}

type RdapRaw = {
  name?: string
  handle?: string
  startAddress?: string
  endAddress?: string
  ipVersion?: string
  entities?: RdapEntity[]
  events?: Array<{ eventAction: string; eventDate: string }>
}

type RdapEntity = {
  vcardArray?: [string, Array<[string, Record<string,unknown>, string, string]>]
  roles?: string[]
  entities?: RdapEntity[]
}

function extractVcardField(entity: RdapEntity, fieldName: string): string | null {
  const vcard = entity.vcardArray?.[1]
  if (!vcard) return null
  const entry = vcard.find(([name]) => name === fieldName)
  return entry ? entry[3] : null
}

export function extractRdapInfo(raw: RdapRaw): RdapInfo {
  let orgName: string | null = null
  let abuseEmail: string | null = null

  for (const entity of raw.entities ?? []) {
    if (entity.roles?.includes('registrant') || entity.roles?.includes('administrative')) {
      orgName = orgName ?? extractVcardField(entity, 'fn')
      for (const sub of entity.entities ?? []) {
        if (sub.roles?.includes('abuse')) {
          abuseEmail = abuseEmail ?? extractVcardField(sub, 'email')
        }
      }
    }
  }

  const regEvent = raw.events?.find(e => e.eventAction === 'registration')

  return {
    name: raw.name ?? raw.handle ?? '',
    orgName,
    abuseEmail,
    registrationDate: regEvent?.eventDate ?? null,
    startAddress: raw.startAddress ?? '',
    endAddress: raw.endAddress ?? '',
    ipVersion: raw.ipVersion ?? 'v4',
  }
}

const rdapCache = new Map<string, RdapInfo>()

export async function fetchRdap(ip: string): Promise<RdapInfo | null> {
  if (rdapCache.has(ip)) return rdapCache.get(ip)!
  try {
    const res = await fetch(`https://rdap.org/ip/${ip}`)
    if (!res.ok) return null
    const raw = await res.json() as RdapRaw
    const info = extractRdapInfo(raw)
    rdapCache.set(ip, info)
    return info
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Запустити тести — PASS**

```bash
pnpm --filter @ipmap/web test
```

Очікувано: всі тести PASS.

- [ ] **Step 5: Написати BlockPanel.tsx**

Створити `apps/web/src/components/panels/BlockPanel.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { IpBlock } from '@ipmap/types'
import { fetchRdap, type RdapInfo } from '@/lib/rdap'

interface BlockPanelProps {
  block: IpBlock
  onClose: () => void
}

function formatSize(size: number): string {
  if (size >= 1e6) return `/${32 - Math.log2(size)} (${(size / 1e6).toFixed(1)}M адрес)`
  if (size >= 1024) return `/${32 - Math.log2(size)} (${(size / 1024).toFixed(0)}K адрес)`
  return `(${size} адрес)`
}

export function BlockPanel({ block, onClose }: BlockPanelProps) {
  const [info, setInfo] = useState<RdapInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setInfo(null)
    fetchRdap(block.start).then(data => {
      setInfo(data)
      setLoading(false)
    })
  }, [block.start])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 50,
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '12px 16px',
        color: '#fff',
        fontFamily: 'monospace',
        minWidth: 280,
        maxWidth: 360,
        pointerEvents: 'all',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>
          {block.start} {formatSize(block.size)}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}
        >
          ×
        </button>
      </div>

      {loading && <div style={{ color: '#64748b', fontSize: 13 }}>Завантаження RDAP...</div>}

      {!loading && !info && (
        <div style={{ color: '#ef4444', fontSize: 13 }}>RDAP недоступний для цього блоку</div>
      )}

      {!loading && info && (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div>
            <span style={{ color: '#64748b' }}>Назва: </span>
            <span>{info.name || '—'}</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Організація: </span>
            <span>{info.orgName || '—'}</span>
          </div>
          {info.abuseEmail && (
            <div>
              <span style={{ color: '#64748b' }}>Abuse: </span>
              <a
                href={`mailto:${info.abuseEmail}`}
                style={{ color: '#60a5fa' }}
              >
                {info.abuseEmail}
              </a>
            </div>
          )}
          {info.registrationDate && (
            <div>
              <span style={{ color: '#64748b' }}>Виділено: </span>
              <span>{info.registrationDate.slice(0, 10)}</span>
            </div>
          )}
          <div>
            <span style={{ color: '#64748b' }}>Діапазон: </span>
            <span style={{ fontSize: 11 }}>{info.startAddress} – {info.endAddress}</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Підключити BlockPanel в page.tsx**

Додати import і використання:

```typescript
import { BlockPanel } from "@/components/panels/BlockPanel";

// В IpMapApp, після CountryPanel:
{selectedBlock && (
  <BlockPanel
    block={selectedBlock}
    onClose={() => setSelectedBlock(null)}
  />
)}
```

- [ ] **Step 7: Перевірити в браузері E2E**

```bash
pnpm --filter @ipmap/web dev
```

Тест сценарій:
1. Глобус обертається, видно кольорові крапки країн (World level)
2. Клік по UA (Україна) → CountryPanel з'являється, камера летить до UA, видно синю сітку блоків
3. Клік по одному блоку → BlockPanel з'являється внизу, через 1-2с завантажується RDAP інфо
4. Кнопка × на BlockPanel → BlockPanel закривається
5. Кнопка «Назад до світу» → повернення на World level, крапки країн знову видно

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/rdap.ts apps/web/src/lib/__tests__/ apps/web/src/components/panels/BlockPanel.tsx apps/web/src/app/
git commit -m "feat: RDAP on-demand block info panel with in-memory cache"
```

---

## Spec Self-Review

**1. Spec coverage:**
- ✅ Перейменування @sessionmap → @ipmap: Task 1
- ✅ Видалення whale arcs: Task 8
- ✅ Видалення exchange markers: Task 8
- ✅ Видалення session logic: Tasks 4, 5, 6
- ✅ Видалення live prices/WS: Tasks 5, 6, 7
- ✅ ETL-скрипт 5 RIR: Task 10
- ✅ CountryAlloc і IpBlock типи: Task 2
- ✅ World level country markers: Task 12
- ✅ Country drill-down cluster + sort за IP (скрипт сортує при генерації): Task 13
- ✅ Камера tween: Task 13
- ✅ RDAP on-demand + кеш: Task 14
- ✅ Числа форматовані: CountryPanel і BlockPanel
- ✅ BigInt для IP: ETL-скрипт Task 10
- ✅ ENV cleanup: Task 7

**2. Type consistency:**
- `UseGlobeOptions.countryData: CountryAlloc | null` — додається в Task 13, відповідає `CountryAlloc` з Task 2 ✅
- `UseGlobeOptions.countryBlocks: IpBlock[]` — відповідає `IpBlock` з Task 2 ✅
- `parseIpData` повертає `CountryAlloc[]` — відповідає тесту в Task 11 ✅
- `fetchRdap` та `extractRdapInfo` — окремі exports, тест тестує `extractRdapInfo` напряму ✅

**3. Placeholders:** немає — весь код конкретний.
