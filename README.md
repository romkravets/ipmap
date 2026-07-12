# ipmap

3D-глобус, що показує розподіл адресного простору IPv4 по країнах — «у кого скільки
IP-адрес у запасі». Дані беруться напряму з офіційних реєстрів RIR (delegated stats),
а не з геолокації трафіку.

Форк sessionmap (крипто-глобус на Three.js) — залишено core
глобуса (шейдери день/ніч, atmosphere glow, terminator line, камера, raycasting),
крипто-частину повністю прибрано.

## Три рівні деталізації

1. **Світ** — одна точка на країну. Розмір і колір ∝ загальна кількість виділених
   IPv4-адрес (США ≈1.6 млрд, найбільше у світі).
2. **Країна** (клік по точці) — блоки країни розкладені кластером біля центроїда,
   розмір і колір маркера ∝ розмір блоку, порядок — за стартовою IP-адресою.
3. **Блок** (клік по блоку) — власник підтягується on-demand через RDAP: назва
   організації, handle, дата виділення, abuse-контакт.

RIR-дані знають лише країну, не координати блоків усередині — розклад блоків
у кластері штучний (сортування за IP), і це свідоме архітектурне рішення, а не баг.

## Демо

Локально: `pnpm dev` → http://localhost:3000

## Stack

| Layer        | Technology                    |
| ------------ | ------------------------------ |
| Framework    | Next.js 14 App Router         |
| Styling      | Tailwind CSS                  |
| 3D Globe     | Three.js (client-only, raw — без react-three-fiber) |
| State        | React Context + useReducer    |
| Shared Types | `packages/types` (TypeScript) |
| Monorepo     | pnpm workspaces + Turborepo   |

Один Next.js застосунок (`apps/web`) — жодного бекенд-сервера. IP/інфраструктурні
дані генеруються build-time ETL-скриптами в статичні JSON, RDAP підтягується
on-demand напряму з браузера.

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)

### Install

```bash
pnpm install
```

### Generate data

Датасети — build-time ETL, генеруються раз (або раз на добу в CI), не realtime.
Без цього кроку глобус буде порожній.

```bash
pnpm build-data          # ipv4-by-country.json, centroids.json (RIR delegated stats)
pnpm build-infra-data    # datacenters.json, ixps.json, submarine-cables.json
```

### Run (development)

```bash
pnpm dev                          # http://localhost:3000

# Якщо Next кешує старе після великих змін:
rm -rf apps/web/.next && pnpm dev
```

Env vars не потрібні для локальної розробки — застосунок не звертається до жодного
API з ключем, увесь стан читається зі статичних JSON у `public/data`.

---

## Project structure

```
ipmap/
├── apps/
│   └── web/                    ← Next.js 14 App Router (порт 3000)
│       ├── src/hooks/useGlobe.ts       ← Three.js сцена (шейдери, маркери, raycasting)
│       ├── src/components/globe/       ← GlobeScene + декоративні шари (столиці, протоки, ресурси)
│       ├── src/components/panels/      ← CountryPanel, BlockPanel, TweaksPanel, LayerTogglePanel
│       └── public/data/                ← датасети (ETL-вихід + geojson для кордонів/доріг)
├── packages/
│   └── types/                  ← спільні TypeScript-типи (CountryAlloc, IpBlock, ...)
├── scripts/                    ← ETL: RIR delegated stats → JSON
│   ├── build-ipv4-data.mjs     ← 5 RIR → ipv4-by-country.json + centroids.json
│   └── build-infra-data.mjs    ← submarine cables + data centers + IXPs
├── render.yaml                 ← Render deploy config
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Key features

| Feature              | Description                                                              |
| --------------------- | -------------------------------------------------------------------------- |
| 3D Globe             | Custom GLSL шейдери день/ніч, atmosphere glow, terminator line, sun marker |
| Country markers      | Розмір і колір ∝ обсяг IPv4-адрес (холодний синій → теплий жовтогарячий)   |
| Block drill-down     | Клік по країні → кластер блоків, розмір/колір ∝ розмір блоку, кільце-підсвітка на hover |
| RDAP on-demand       | Клік по блоку → назва орг., handle, дата виділення, abuse-контакт (кеш у пам'яті) |
| Infra layers         | Підводні кабелі, дата-центри, IXP (hover-тултип: провайдер/місто/мережі-учасники) |
| Decorative layers    | Столиці, стратегічні протоки, економічні точки, кордони, сезони — вмикаються через панель Layers |
| Tweaks panel         | Клавіша **E** — режим камери, швидкість обертання, часовий зсув, видимість шарів |

---

## Data pipeline (ETL)

Джерела — публічні, оновлюються щодня/щотижня, скрипти запускаються вручну або
в CI, це не realtime-потік.

**`scripts/build-ipv4-data.mjs`** — завантажує 5 delegated-файлів RIR:

- `ripencc`, `arin`, `apnic`, `lacnic`, `afrinic` — офіційний формат
  `registry|cc|type|start|value|date|status`, беруться статуси `allocated`/`assigned`.
- Центроїди країн — Natural Earth (`ISO_A2` → `{lat, lng, name}`).
- Порівняння/сортування IP — через BigInt (32-біт число), не рядкове.

**`scripts/build-infra-data.mjs`** — підводні кабелі, дата-центри, IXP з публічних
GeoJSON/API джерел.

Вихід — `apps/web/public/data/{ipv4-by-country,centroids,datacenters,ixps,submarine-cables}.json`,
усі gitignored (генеруються, не комітяться).

---

## Testing

```bash
pnpm --filter @ipmap/web test           # vitest, юніт-тести pure-функцій
pnpm --filter @ipmap/web test:coverage
pnpm type-check                          # tsc --noEmit по всіх workspace-пакетах
```

---

## Build & deploy

```bash
pnpm build
```

Деплой — [Render](https://render.com) (`render.yaml`), один web-сервіс `ipmap-web`.
`buildCommand` генерує ETL-датасети перед `next build` — без цього кроку прод
показав би порожній глобус, бо `public/data/*.json` не в git.
