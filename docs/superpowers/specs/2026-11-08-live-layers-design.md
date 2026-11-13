# Живі шари: відключення інтернету, супутники, фішинг

Дата: 2026-11-08

## Контекст

Статичний «фізичний інтернет» уже є: підводні кабелі (650, tbotnz GeoJSON),
дата-центри (109 регіонів AWS/GCP/Azure/Equinix), IXP (939, PeeringDB),
IPv4 по країнах + RDAP + AbuseIPDB на рівні блоку.

Бракує **живого** виміру — того, що змінюється щогодини. Три нові шари:

| Шар | Що показує | Джерело | Ключ | Оновлення |
|-----|-----------|---------|------|-----------|
| A. Відключення | де зараз падає інтернет і чому | Cloudflare Radar Outage Center | так (безкоштовний токен) | 15 хв |
| B. Супутники | Starlink, МКС, GPS, OneWeb у реальному часі | CelesTrak GP (OMM JSON) + satellite.js | ні | орбіти: 2–6 год, позиції: щосекунди в браузері |
| C. Фішинг | де хостяться свіжі фішингові/шкідливі URL і кого підробляють | OpenPhish (community feed) + URLhaus (abuse.ch) | URLhaus: так (безкоштовний Auth-Key) | 6 год |

Усі дані публічні. Жодних власних серверів-пасток, жодного сканування.

Рекомендований порядок: **0 → B → A → C** (від простого й ефектного до складного).

---

## 0. Підготовка: не роздувати `useGlobe.ts`

`useGlobe.ts` уже ~60 KB і містить усі шари в одному `useEffect`. Три нові
шари з власною анімацією зроблять його некерованим.

Рішення: кожен новий шар — окремий модуль `apps/web/src/lib/layers/<name>.ts`
з єдиним інтерфейсом:

```ts
export interface GlobeLayer<TData> {
  group: THREE.Group                 // додається в scene, toggle через .visible
  setData(data: TData): void         // перебудова при нових даних
  update(dt: number, now: Date): void // виклик з animate()
  pick?(hit: THREE.Intersection): HoverInfo | null // для raycast/hover
  dispose(): void
}
```

У `useGlobe.ts` лишається тільки реєстрація: створити шар, додати `group`
у `scene` та `window.globeLayerGroups`, викликати `update()` в `animate()`,
`dispose()` в cleanup. Хелпери `latLngToVec3` і `greatCircleArc` винести
в `lib/geo3d.ts` (зараз вони локальні в `useGlobe.ts`).

`LayerKey` у `useLayers.ts` розширити: `"outages" | "satellites" | "phishing"`.
Toggle-хендлер замінити на загальний `groups[key].visible = next[key]`
замість ланцюжка `if`.

Існуючі шари (кабелі, ДЦ, IXP) переносити не обов'язково — лише якщо
буде час. Нові пишемо одразу в новому форматі.

---

## B. Супутники (перший — без ключів, максимум вау)

### Дані

- `GET /api/satellites?group=<group>` — серверний роут-кеш.
  Не можна, щоб кожен браузер стукав у CelesTrak напряму: у них
  rate limit, а при перевищенні — блок по IP.
- Роут тягне `https://celestrak.org/NORAD/elements/gp.php?GROUP=<group>&FORMAT=json`,
  кешує через `fetch(..., { next: { revalidate: 7200 } })` (2 год).
- Whitelist груп: `stations`, `starlink`, `oneweb`, `gps-ops`, `galileo`,
  `weather`. Будь-що інше → 400 (той самий принцип, що в `/api/abuse`:
  роут не має бути відкритим проксі).
- **Тільки OMM JSON, не TLE.** З 2026-07 нові об'єкти отримують 6-значні
  NORAD-номери, які не влазять у формат TLE. Для Starlink це вже актуально.
- Відповідь стискати: лишити тільки поля для SGP4 (`OBJECT_NAME`,
  `NORAD_CAT_ID`, `EPOCH`, `MEAN_MOTION`, `ECCENTRICITY`, `INCLINATION`,
  `RA_OF_ASC_NODE`, `ARG_OF_PERICENTER`, `MEAN_ANOMALY`, `BSTAR`,
  `MEAN_MOTION_DOT`, `MEAN_MOTION_DDOT`). Starlink — ~10k об'єктів.

### Розрахунок позицій

- Бібліотека `satellite.js` (перевірити версію з підтримкою OMM — `json2satrec`).
- SGP4 для 10k об'єктів щокадру — забагато для головного потоку.
  Рахувати у **Web Worker** раз на 1 с, повертати `Float32Array`
  (lat, lng, altKm) через transferable. У кадрах між оновленнями —
  лінійна інтерполяція в шейдері / на CPU.
- CSP: зараз `worker-src blob:`. Якщо Next бандлить воркер як файл
  (`new Worker(new URL('./sat.worker.ts', import.meta.url))`) — додати `'self'`.

### Рендер

- `THREE.Points` з одним `BufferGeometry` на групу, колір за групою.
- Радіус: `r = 1 + altKm / 6371`. Starlink (~550 км) ≈ 1.086 — видно
  «оболонку» навколо Землі. Перемикач у Tweaks «перебільшити висоту ×3».
- МКС — окремий маркер + лінія орбіти на ±1 виток (90 точок).
- GEO-супутники (~35 786 км, r ≈ 6.6) — за межами типового зуму; або
  окрема група з віддаленням камери, або не показувати в v1.

### Фічі

- Hover: назва, NORAD ID, висота, швидкість.
- **«Над Кременцем зараз»**: спостерігач 50.10° N, 25.73° E. Через
  `satellite.ecfToLookAngles` — список об'єктів з elevation > 10°.
  Окремо: найближчий видимий проліт МКС сьогодні ввечері.
- Лічильник: «Starlink на орбіті зараз: N».

### Ризики

- Продуктивність на слабких пристроях → за замовчуванням вмикати лише
  `stations`, Starlink — по кліку.
- CelesTrak: умови дозволяють некомерційне використання; ipmap —
  некомерційний, ОК.

---

## A. Відключення інтернету (Cloudflare Radar)

### Дані

- `GET /api/outages` → `https://api.cloudflare.com/client/v4/radar/annotations/outages?dateRange=7d&limit=100&format=json`
  з `Authorization: Bearer ${CLOUDFLARE_API_TOKEN}` (тільки сервер,
  без `NEXT_PUBLIC_`; додати в `.env.example`). Кеш `revalidate: 900`.
- Стиснута відповідь:
  ```ts
  interface Outage {
    id: string
    locations: string[]        // ISO alpha-2
    asns: { asn: number; name: string }[]
    cause: string              // POWER_OUTAGE, CABLE_CUT, GOVERNMENT_DIRECTED, WEATHER…
    type: string               // NATIONWIDE, REGIONAL, NETWORK…
    startDate: string
    endDate: string | null     // null = триває зараз
    description: string | null
    linkedUrl: string | null
  }
  ```
- Координати: ISO-код → `public/data/centroids.json` (вже є).

### Рендер

- На центроїді країни — пульсуюче кільце (шейдер або scale-анімація
  в `update()`). Колір за причиною: живлення — бурштиновий, кабель —
  блакитний, урядове відключення — червоний, погода — сірий.
- Активні (`endDate === null`) — яскраві й пульсують; завершені за 7 днів —
  тьмяні статичні.
- **Зв'язок з кабелями:** якщо `cause === CABLE_CUT` — підсвітити кабелі,
  що виходять у цю країну (є в `submarine-cables.json`, треба матчинг
  країна → кабель; у v1 можна пропустити).
- Панель: список подій, причина, тип, тривалість, ASN, посилання на джерело.

### Чому це сильно

Для України видно провали зв'язності під час атак на енергетику —
Radar прямо класифікує їх як `POWER_OUTAGE` по регіонах.

---

## C. Карта фішингу

### Дані (серверний ETL)

1. **Фіди:**
   - OpenPhish community feed — текстовий список URL, без ключа.
     Перевірити умови використання community-фіду.
   - URLhaus `recent` (malware-distribution URL за 3 дні, до 1000) —
     потрібен безкоштовний `URLHAUS_AUTH_KEY` (з 2025-06-30 обов'язковий).
     Fair use для некомерційних проєктів.
2. **Нормалізація:** витягти host, дедуплікувати.
3. **Host → IP:** DNS A-запис з сервера (`node:dns/promises`), пул
   паралельності ~50, таймаут 2 с на хост.
4. **IP → країна: власні RIR-дані.** У `ipv4-by-country.json` уже є
   `blocksByCountry` — будуємо відсортований масив діапазонів і робимо
   бінарний пошук. Без MaxMind, у дусі проєкту (див. CLAUDE.md:
   «або RIR, або міста, не половина на половину»).
5. **Бренд-ціль:** словник ключових слів у host/path → бренд + країна
   бренду. Старт: privat, monobank, novaposhta, olx, diia, ukrposhta,
   rozetka, dtek + paypal, microsoft, office365, apple, netflix, dhl,
   facebook, instagram, telegram.
6. **Агрегація** → `PhishingSnapshot`:
   ```ts
   interface PhishingSnapshot {
     generatedAt: string
     byHostCountry: Record<string, number>        // UA: 12, US: 340…
     flows: { from: string; to: string; brand: string; count: number }[]
     topBrands: { brand: string; count: number }[]
     samples: { host: string; brand: string | null; cc: string }[] // знешкоджені
   }
   ```

### Де запускати

- v1: `GET /api/phishing` з `revalidate: 21600` (6 год), обробляти
  не більше 500 найсвіжіших хостів.
- Якщо serverless-таймаут не вкладається — перенести ETL у GitHub Action
  (cron кожні 6 год), результат класти в Vercel Blob або в окремий
  data-бранч; фронт читає готовий JSON.

### Рендер

- Країни-хостинги: вертикальні «шпилі» або підсвічене кільце, висота ∝ кількості.
- **Дуги «звідки атакують → кого підробляють»:** `greatCircleArc` (уже є)
  від країни хостингу до країни бренду. Наприклад, фішинг під ПриватБанк,
  що хоститься в Нідерландах → дуга NL → UA. Товщина ∝ count.
- Панель: топ брендів, топ країн-хостингів, приклади хостів.

### Безпека (обов'язково)

- **Жодних клікабельних посилань** на фішингові URL. Показувати лише host
  і тільки у знешкодженому вигляді: `privat24-login[.]com`, `hxxps://`.
- Сервер **не завантажує** самі фішингові сторінки — лише DNS-резолв хоста.
- URL повністю в API-відповідь не віддавати (тільки host), щоб ipmap
  не став дзеркалом фіду.
- Пояснення в UI: «дані з публічних фідів, оновлюються раз на 6 год,
  частина сайтів уже може бути видалена».

---

## Зміни в спільних місцях

- `packages/types/src/index.ts` — `Outage`, `SatelliteGroup`, `SatPosition`,
  `PhishingSnapshot`.
- `apps/web/.env.example` — `CLOUDFLARE_API_TOKEN=`, `URLHAUS_AUTH_KEY=`.
- `next.config.js` CSP: `connect-src` не змінюється (усе через `'self'`
  API-роути); `worker-src` — додати `'self'`, якщо воркер не blob.
- `LayerTogglePanel` — три нові рядки + легенда кольорів.
- Тести (vitest, як для abuseipdb): валідація whitelist груп у
  `/api/satellites`, парсинг Radar-відповіді, IP→країна бінарний пошук,
  знешкодження host'ів, витік ключів у відповідях роутів.

## Поза межами v1

- Матчинг відключень з конкретними кабелями.
- Історична шкала часу (повзунок «що було тиждень тому»).
- BGP-хайджеки (Radar `bgp/hijacks`) — кандидат на шар D.
- IPv6-адопція по країнах — кандидат на шар E (APNIC stats).
