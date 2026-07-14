# AbuseIPDB-інтеграція для block-панелі

Дата: 2026-07-14

## Контекст

Рівень «Блок» (клік по кубику в кластері країни) вже показує RDAP-дані
(`BlockPanel.tsx` + `lib/rdap.ts`): назву організації, abuse-email, дату
виділення. Потрібно доповнити його інформацією про репутацію блоку —
Abuse Confidence Score з AbuseIPDB (https://www.abuseipdb.com/), на основі
`start`-адреси блоку.

AbuseIPDB вимагає секретний API-ключ у заголовку запиту (`Key`). Ключ не може
потрапляти в браузер — це секрет, а не публічний артефакт.

Вільний тариф AbuseIPDB: 1000 запитів/день. Це обмежує, як часто можна
дозволити собі стукати в API.

## Рішення

### 1. Серверний proxy-роут

`apps/web/src/app/api/abuse/route.ts` — Next.js App Router route handler.

- `GET /api/abuse?ip=<ipv4>`
- Валідація: `ip` має відповідати IPv4-формату (regex), інакше `400`.
  Без цього роут перетворюється на відкритий проксі для довільних IP —
  хтось ззовні міг би використати наш сервер, щоб пробивати чужі IP через
  наш ключ і наш денний ліміт.
- Ключ `ABUSEIPDB_API_KEY` читається з `process.env` (тільки на сервері,
  БЕЗ префіксу `NEXT_PUBLIC_` — інакше Next.js заб'є його в клієнтський бандл).
- Запит до `https://api.abuseipdb.com/api/v2/check?ipAddress=<ip>&maxAgeInDays=90`
  із заголовком `Key: <ABUSEIPDB_API_KEY>`, `Accept: application/json`.
- У відповідь клієнту повертається стиснута підмножина полів (не весь raw
  AbuseIPDB payload):
  ```ts
  interface AbuseInfo {
    score: number           // abuseConfidenceScore, 0–100
    totalReports: number
    isTor: boolean
    isp: string | null
    domain: string | null
    usageType: string | null
    lastReportedAt: string | null
  }
  ```
- Помилки AbuseIPDB (429, 5xx, мережа) → роут повертає `null`/помилку,
  клієнт показує "недоступно", не валить решту панелі.

CSP (`next.config.js`, `connect-src`) змінювати не треба: браузер звертається
лише до `'self'` (`/api/abuse`), запит до `api.abuseipdb.com` іде з сервера.

### 2. Секрет і `.env`

- `apps/web/.env.local` — реальний ключ, вже покритий `.gitignore` (`.env.local`).
- `apps/web/.env.example` — новий файл, комітиться навмисно (як зазначено
  коментарем у `.gitignore`), містить лише
  ```
  ABUSEIPDB_API_KEY=
  ```

### 3. Клієнтський кеш `apps/web/src/lib/abuseipdb.ts`

Дзеркалить структуру `lib/rdap.ts`:

- `fetchAbuse(ip: string): Promise<AbuseInfo | null>` — викликається ТІЛЬКИ
  при відкритті `BlockPanel` (клік по блоку), не при hover. Порядок пошуку:
  1. in-memory `Map` (як зараз для RDAP);
  2. `localStorage` (ключ `abuseipdb:<ip>`, значення `{ data, fetchedAt }`,
     TTL 24 години — якщо `Date.now() - fetchedAt > 24h`, вважати застарілим
     і перезапитати);
  3. інакше — `fetch('/api/abuse?ip=' + ip)`, результат пишеться і в memory,
     і в `localStorage`.
- `getCachedAbuse(ip: string): AbuseInfo | null` — синхронне читання
  memory/`localStorage` БЕЗ мережевого запиту. Використовується hover-тултipом,
  щоб не плодити запити при русі миші по кластеру блоків.

### 4. `BlockPanel.tsx` — нова секція

Незалежний `useEffect`/`useState` від RDAP-секції (окремий loading/error стан),
щоб збій AbuseIPDB не ламав показ RDAP-даних і навпаки.

Показує:
- Score як кольоровий бейдж/текст: `0–24` зелений (низький ризик),
  `25–74` жовтий (середній), `75–100` червоний (високий);
- кількість звітів (`totalReports`);
- ISP, домен, тип використання (`usageType`), якщо є;
- Tor: так/ні;
- дата останнього звіту (`lastReportedAt`), якщо є.

Якщо `null` (помилка/немає даних) — рядок "Abuse-дані недоступні", без падіння
решти панелі.

### 5. Hover-тултip (`page.tsx`)

Поточний тултip при наведенні на блок показує `start` + розмір. Додається
маленька кольорова крапка (той самий поріг 0–24/25–74/75–100) **лише якщо**
`getCachedAbuse(block.start)` повертає не-`null` (тобто блок уже перевіряли
раніше кліком). Якщо кешу нема — крапка не малюється (не натякаємо на дані,
яких ще не отримали, і не робимо мережевий запит при hover).

## Що НЕ робимо в цій ітерації

- Не змінюємо колір/розмір самого кубика блоку на глобусі за abuse-score —
  колір кубика й далі кодує розмір блоку (обсяг IP), як зараз.
- Не додаємо серверний rate-limit/захист роуту від зловживань понад базову
  валідацію формату IP — прийнятний ризик для MVP при малому трафіку.
- Не батчимо перевірку всіх блоків країни наперед — тільки on-demand при кліку.

## Тестування

- Unit-тест на `extractAbuseInfo`-подібну функцію парсингу відповіді AbuseIPDB
  (аналогічно `rdap.test.ts`).
- Unit-тест на TTL-логіку кешу (`localStorage`, прострочення 24год).
- Route handler: тест валідації IP (400 на невалідний ввід), проксі не палить
  ключ у відповіді клієнту.
