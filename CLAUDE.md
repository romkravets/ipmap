# CLAUDE.md — ipmap (форк sessionmap)

Цей файл — інструкція для Claude Code. Читай його першим у кожній сесії.
Відповідай і пиши коментарі українською. Код, назви змінних, ідентифікатори — англійською.

---

## Що будуємо

Форк `sessionmap` (3D-глобус на Three.js). Замість крипто-бірж і whale-arc'ів
глобус показує **розподіл адресного простору IPv4 по країнах** — «у кого скільки
IP-адрес у запасі». Джерело даних — офіційні реєстри RIR (delegated stats),
а не геолокація трафіку.

Робоча назва проєкту: **ipmap**.

### Три рівні деталізації (level-of-detail)

1. **Світ** — одна точка на країну на глобусі. Розмір/яскравість ∝ загальна
   кількість виділених IPv4-адрес країни. Видно глобальну нерівність (США ≈1.6 млрд).
2. **Країна** (клік по точці) — блоки цієї країни розкладені кластером біля
   центроїда. Розмір точки ∝ розмір блоку. Порядок розкладу — за стартовою
   IP-адресою (сусідні на екрані = сусідні в адресному просторі), НЕ випадково.
3. **Блок** (клік по блоку) — власник: підтягнути on-demand через RDAP
   (назва орг., AS-номер, дата виділення, abuse-контакт).

Чесне обмеження: RIR-дані знають лише країну, не координати блоків усередині.
Тому розклад блоків усередині країни — штучний (кластер+сортування за IP), і це ОК.
НЕ змішувати з MaxMind city-level геолокацією — або структурний розклад (RIR),
або міста (MaxMind), не половина на половину.

---

## Стек (успадкований від sessionmap)

| Шар          | Технологія                    |
| ------------ | ----------------------------- |
| Framework    | Next.js 14 App Router         |
| Styling      | Tailwind CSS                  |
| 3D Globe     | Three.js (client-only)        |
| State        | React Context + useReducer    |
| Сервер       | Node.js + Express (`ws` більше не потрібен для realtime) |
| Shared Types | `packages/types` (TypeScript) |
| Monorepo     | pnpm workspaces + Turborepo   |

Вимоги: Node.js ≥ 20, pnpm ≥ 9.

### Структура репозиторію

```
ipmap/
├── apps/
│   ├── web/          ← Next.js 14 (порт 3000)
│   └── server/       ← Express (порт 4000) — стає легким API
├── packages/
│   └── types/        ← спільні TS-типи
├── scripts/
│   └── build-ipv4-data.mjs   ← НОВИЙ: ETL з RIR → JSON
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Що ПРИБРАТИ з крипто-частини

Видаляй акуратно, комітами по одному модулю, перевіряючи що глобус ще рендериться.

 Core глобуса ЗАЛИШИТИ повністю:
- сфера, GLSL-шейдери день/ніч, atmosphere glow, terminator line, sun marker;
- функцію конвертації `lat/lng → 3D-вектор на сфері` (вона від exchange markers) —
  це головне, що перевикористовуємо;
- камеру, обертання, raycasting для кліків, tweaks-панель (клавіша E).

Прибрати (крипто-специфічне):
- **Whale arcs** — анімовані great-circle дуги переказів. Видалити компонент,
  спавнер, типи `WhaleTransfer`.
- **Exchange markers** — 20 бірж. Видалити датасет бірж і рендер їхніх маркерів
  (але ЗБЕРЕГТИ загальний механізм маркерів — переінструментувати під країни).
- **Session logic** — Asia/Europe/Americas сесії, countdown, overlap. Видалити.
- **Live prices** — Binance WS `!ticker@arr`, CoinGecko. Видалити WS-клієнт,
  fallback-ціни, `STALE` badge, reconnect-backoff, Zod price-schemas.
- **Server realtime** — `ws`-сервер більше не потрібен (немає realtime-потоку).
  `apps/server` стає простим REST/статичним API (див. нижче).
- ENV: прибрати `BINANCE_WS_URL`, `COINGECKO_API_URL`, `NEXT_PUBLIC_WS_URL`.

Terminal mode — на розсуд: можна лишити як «текстовий» перегляд таблиці країн.

---

## Що ДОДАТИ

### 1. ETL-скрипт `scripts/build-ipv4-data.mjs`

Завантажує 5 RIR delegated-файлів, парсить IPv4-рядки, агрегує по країні.

Джерела (raw text, оновлення щодня):
- `https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest`
- `https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest`
- `https://ftp.apnic.net/pub/stats/apnic/delegated-apnic-latest`
- `https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest`
- `https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest`

Формат рядка: `registry|cc|type|start|value|date|status`
Приклад: `ripencc|UA|ipv4|193.108.0.0|8192|20120101|allocated`
- Для IPv4 `value` = **кількість адрес** у блоці (не префікс!).
- Брати статуси `allocated` + `assigned`. Ігнорувати `reserved`/`available`
  (це нерозподілений запас — можна винести окремим шаром «вільне», опційно).
- Пропускати рядки з `cc === "*"` та коментарі (`#`).

Вихід `apps/web/public/data/ipv4-by-country.json`:
```json
{
  "byCountry":     { "US": 1610612736, "UA": 12058624, ... },
  "blocksByCountry": { "UA": [{ "start": "193.108.0.0", "size": 8192 }, ...] }
}
```

Центроїди країн (RIR координат не має) — окремий публічний geojson,
змапити ISO-cc → `{lat, lng}`. Тримати як `apps/web/public/data/centroids.json`.

Скрипт запускати руками або в CI раз на добу. Це build-time ETL, не realtime.

### 2. Data-шар у web

- Лоадер, що читає `ipv4-by-country.json` + `centroids.json`.
- Тип у `packages/types`:
  ```ts
  export interface CountryAlloc { cc: string; name: string; ipCount: number; lat: number; lng: number; }
  export interface IpBlock { start: string; size: number; }
  ```

### 3. Рендер рівнів на глобусі

- Рівень «Світ»: маркер на країну, `size = f(ipCount)`, колір за обсягом.
  Перевикористати існуючий механізм маркерів від exchange markers.
- Рівень «Країна»: при кліку — raycast дає `cc`, будуємо блоки кластером біля
  центроїда, сортовані за `start` (BigInt-порівняння IP). Камеру довернути на країну.
- Кнопка «Назад» повертає на рівень світу.

### 4. RDAP on-demand (рівень блоку)

При кліку по блоку — fetch до RDAP, кешувати відповідь:
- RIPE: `https://rdap.db.ripe.net/ip/{ip}`
- або універсальний бутстрап через `https://rdap.org/ip/{ip}` (редіректить у потрібний RIR).
Витягнути: назву орг., handle, дату, abuse email. Показати в панелі.
Не класти в статичний JSON — тільки on-demand + кеш у пам'яті.

---

## Візуальні рішення (узгоджено)

- Старт: кластер блоків біля центроїда + **сортування за стартовою IP**
  (майже безкоштовно, робить нижній рівень осмисленим).
- Hilbert-розклад блоків країни — окремий опційний режим НА ПОТІМ, не в MVP.
- Колірна шкала обсягу: від холодного (мало адрес) до теплого/яскравого (багато).

---

## Команди

```bash
pnpm install
pnpm dev                              # web + server разом
pnpm --filter @ipmap/web dev          # лише web  → http://localhost:3000
node scripts/build-ipv4-data.mjs      # згенерувати датасет країн
pnpm build                            # прод-збірка
```

Якщо Next кешує старе після великих змін:
```bash
rm -rf apps/web/.next && pnpm --filter @ipmap/web dev
```

---

## Робочі правила для Claude Code

- Працюй маленькими комітами; після видалення крипто-модуля перевіряй, що глобус
  ще рендериться, тоді наступний.
- Не чіпай core глобуса й шейдери без потреби — вони робочі, це фундамент.
- Перейменування пакетів `@sessionmap/*` → `@ipmap/*` роби разом (package.json,
  imports, pnpm-workspace, turbo.json), одним комітом.
- Числа для показу завжди форматуй (`1.6 млрд`, `12 млн`), не сирі байти.
- Порівняння IP-адрес — через BigInt (IPv4 → 32-біт число), не рядкове.
- Питай перед незворотним видаленням цілих директорій.
- README онови під ipmap, коли MVP запрацює.
