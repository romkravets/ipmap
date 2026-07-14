# AbuseIPDB Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показувати AbuseIPDB-скор репутації для кожного IP-блоку в `BlockPanel` (клік) і кольоровим індикатором у hover-тултипі, не розкриваючи секретний API-ключ клієнту.

**Architecture:** Секретний ключ живе тільки на сервері й використовується у новому Next.js route handler `apps/web/src/app/api/abuse/route.ts`, який проксіює запит до `api.abuseipdb.com` і повертає клієнту стиснуту підмножину полів. Клієнтський модуль `apps/web/src/lib/abuseipdb.ts` кешує ці відповіді (in-memory Map + `localStorage` з TTL 24 год) і викликає роут лише при кліку по блоку (не при hover). `BlockPanel.tsx` показує повну секцію (score, звіти, ISP, Tor, дата), а hover-тултip у `page.tsx` малює кольорову крапку, читаючи ТІЛЬКИ кеш (без мережі).

**Tech Stack:** Next.js 14 App Router (Route Handlers), TypeScript, vitest + jsdom (наявний тестовий стек монорепо), без нових залежностей.

## Global Constraints

- `ABUSEIPDB_API_KEY` читається лише через `process.env` у серверному коді (route handler). НІКОЛИ не префіксувати `NEXT_PUBLIC_` і не імпортувати цю змінну в клієнтські компоненти.
- Роут `/api/abuse` валідує параметр `ip` на відповідність IPv4-формату й повертає `400` на невалідний ввід — без цього роут стає відкритим проксі для довільних IP.
- CSP (`apps/web/next.config.js`, `connect-src`) НЕ змінювати — клієнт звертається лише до `'self'`.
- `fetchAbuse` викликається лише при відкритті `BlockPanel` (клік), НЕ при hover.
- Кеш у `localStorage`: ключ `abuseipdb:<ip>`, TTL 24 години (`24 * 60 * 60 * 1000` мс).
- Кольорові пороги для score: `0–24` зелений `#4ade80`, `25–74` жовтий `#facc15`, `75–100` червоний `#ef4444`.
- Колір/розмір самого кубика блоку на глобусі (`useGlobe.ts`) НЕ змінювати — він і далі кодує розмір блоку, не abuse-score.
- `apps/web/.env.local` (реальний ключ) — НЕ комітити, вже покритий `.gitignore`. `apps/web/.env.example` — комітиться навмисно, містить лише `ABUSEIPDB_API_KEY=` без значення.
- Відповіді, помилки, коментарі — українською; ідентифікатори коду — англійською (за CLAUDE.md).

---

### Task 1: Клієнтський модуль `lib/abuseipdb.ts` (типи, валідація, парсинг, кеш)

**Files:**
- Create: `apps/web/src/lib/abuseipdb.ts`
- Test: `apps/web/src/lib/__tests__/abuseipdb.test.ts`

**Interfaces:**
- Produces:
  - `interface AbuseInfo { score: number; totalReports: number; isTor: boolean; isp: string | null; domain: string | null; usageType: string | null; lastReportedAt: string | null }`
  - `function isValidIpv4(ip: string): boolean`
  - `function extractAbuseInfo(raw: { data?: { abuseConfidenceScore?: number; totalReports?: number; isTor?: boolean; isp?: string | null; domain?: string | null; usageType?: string | null; lastReportedAt?: string | null } }): AbuseInfo`
  - `function getAbuseColor(score: number): string`
  - `function getCachedAbuse(ip: string): AbuseInfo | null` — синхронне читання, без мережі
  - `function fetchAbuse(ip: string): Promise<AbuseInfo | null>` — мережевий запит до `/api/abuse?ip=<ip>`, з кешуванням

- [ ] **Step 1: Написати тест на `isValidIpv4`**

```typescript
// apps/web/src/lib/__tests__/abuseipdb.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidIpv4, extractAbuseInfo, getAbuseColor, getCachedAbuse, fetchAbuse } from '../abuseipdb'

describe('isValidIpv4', () => {
  it('приймає валідну IPv4-адресу', () => {
    expect(isValidIpv4('193.108.0.0')).toBe(true)
    expect(isValidIpv4('8.8.8.8')).toBe(true)
  })

  it('відхиляє невалідний ввід', () => {
    expect(isValidIpv4('not-an-ip')).toBe(false)
    expect(isValidIpv4('999.999.999.999')).toBe(false)
    expect(isValidIpv4('1.2.3')).toBe(false)
    expect(isValidIpv4('1.2.3.4.5')).toBe(false)
    expect(isValidIpv4('')).toBe(false)
    expect(isValidIpv4('::1')).toBe(false)
  })
})
```

- [ ] **Step 2: Запустити тест, переконатись що падає**

Run: `pnpm --filter @ipmap/web test -- abuseipdb`
Expected: FAIL — `../abuseipdb` module not found

- [ ] **Step 3: Реалізувати `isValidIpv4` і базовий файл модуля**

```typescript
// apps/web/src/lib/abuseipdb.ts
export interface AbuseInfo {
  score: number
  totalReports: number
  isTor: boolean
  isp: string | null
  domain: string | null
  usageType: string | null
  lastReportedAt: string | null
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function isValidIpv4(ip: string): boolean {
  const match = IPV4_RE.exec(ip)
  if (!match) return false
  return match.slice(1, 5).every(octet => Number(octet) <= 255)
}
```

- [ ] **Step 4: Запустити тест, переконатись що проходить**

Run: `pnpm --filter @ipmap/web test -- abuseipdb`
Expected: PASS (2 tests)

- [ ] **Step 5: Написати тест на `extractAbuseInfo`**

```typescript
describe('extractAbuseInfo', () => {
  it('витягує поля з відповіді AbuseIPDB', () => {
    const raw = {
      data: {
        abuseConfidenceScore: 42,
        totalReports: 7,
        isTor: false,
        isp: 'Some ISP',
        domain: 'example.com',
        usageType: 'Data Center/Web Hosting/Transit',
        lastReportedAt: '2026-06-01T12:00:00Z',
      },
    }
    const info = extractAbuseInfo(raw)
    expect(info.score).toBe(42)
    expect(info.totalReports).toBe(7)
    expect(info.isTor).toBe(false)
    expect(info.isp).toBe('Some ISP')
    expect(info.domain).toBe('example.com')
    expect(info.usageType).toBe('Data Center/Web Hosting/Transit')
    expect(info.lastReportedAt).toBe('2026-06-01T12:00:00Z')
  })

  it('підставляє дефолти, коли поля відсутні', () => {
    const info = extractAbuseInfo({})
    expect(info.score).toBe(0)
    expect(info.totalReports).toBe(0)
    expect(info.isTor).toBe(false)
    expect(info.isp).toBeNull()
    expect(info.domain).toBeNull()
    expect(info.usageType).toBeNull()
    expect(info.lastReportedAt).toBeNull()
  })
})
```

- [ ] **Step 6: Реалізувати `extractAbuseInfo`**

```typescript
interface AbuseRawData {
  abuseConfidenceScore?: number
  totalReports?: number
  isTor?: boolean
  isp?: string | null
  domain?: string | null
  usageType?: string | null
  lastReportedAt?: string | null
}

interface AbuseRaw {
  data?: AbuseRawData
}

export function extractAbuseInfo(raw: AbuseRaw): AbuseInfo {
  const d = raw.data ?? {}
  return {
    score: d.abuseConfidenceScore ?? 0,
    totalReports: d.totalReports ?? 0,
    isTor: d.isTor ?? false,
    isp: d.isp ?? null,
    domain: d.domain ?? null,
    usageType: d.usageType ?? null,
    lastReportedAt: d.lastReportedAt ?? null,
  }
}
```

- [ ] **Step 7: Запустити тести, переконатись що всі проходять**

Run: `pnpm --filter @ipmap/web test -- abuseipdb`
Expected: PASS (4 tests)

- [ ] **Step 8: Написати тест на `getAbuseColor`**

```typescript
describe('getAbuseColor', () => {
  it('повертає зелений для низького ризику', () => {
    expect(getAbuseColor(0)).toBe('#4ade80')
    expect(getAbuseColor(24)).toBe('#4ade80')
  })
  it('повертає жовтий для середнього ризику', () => {
    expect(getAbuseColor(25)).toBe('#facc15')
    expect(getAbuseColor(74)).toBe('#facc15')
  })
  it('повертає червоний для високого ризику', () => {
    expect(getAbuseColor(75)).toBe('#ef4444')
    expect(getAbuseColor(100)).toBe('#ef4444')
  })
})
```

- [ ] **Step 9: Реалізувати `getAbuseColor`**

```typescript
export function getAbuseColor(score: number): string {
  if (score >= 75) return '#ef4444'
  if (score >= 25) return '#facc15'
  return '#4ade80'
}
```

- [ ] **Step 10: Запустити тести, переконатись що всі проходять**

Run: `pnpm --filter @ipmap/web test -- abuseipdb`
Expected: PASS (7 tests)

- [ ] **Step 11: Написати тести на кеш (`getCachedAbuse`, `fetchAbuse`)**

```typescript
const sampleInfo = {
  score: 10, totalReports: 1, isTor: false,
  isp: 'ISP', domain: null, usageType: null, lastReportedAt: null,
}

describe('getCachedAbuse / fetchAbuse', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getCachedAbuse повертає null, якщо кешу нема', () => {
    expect(getCachedAbuse('1.2.3.4')).toBeNull()
  })

  it('fetchAbuse не робить мережевий запит, якщо є валідний кеш у localStorage', async () => {
    localStorage.setItem(
      'abuseipdb:1.2.3.4',
      JSON.stringify({ data: sampleInfo, fetchedAt: Date.now() }),
    )
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAbuse('1.2.3.4')
    expect(result).toEqual(sampleInfo)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetchAbuse ігнорує прострочений кеш (TTL 24год) і йде в мережу', async () => {
    const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000
    localStorage.setItem(
      'abuseipdb:5.6.7.8',
      JSON.stringify({ data: sampleInfo, fetchedAt: staleTimestamp }),
    )
    const freshInfo = { ...sampleInfo, score: 99 }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(freshInfo),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAbuse('5.6.7.8')
    expect(fetchMock).toHaveBeenCalledWith('/api/abuse?ip=5.6.7.8')
    expect(result).toEqual(freshInfo)
  })

  it('fetchAbuse повертає null при мережевій помилці', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await fetchAbuse('9.9.9.9')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 12: Запустити тести, переконатись що падають (`getCachedAbuse`/`fetchAbuse` ще не реалізовані)**

Run: `pnpm --filter @ipmap/web test -- abuseipdb`
Expected: FAIL — `getCachedAbuse is not a function` / `fetchAbuse is not a function`

- [ ] **Step 13: Реалізувати кеш і `getCachedAbuse`/`fetchAbuse`**

```typescript
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const memoryCache = new Map<string, AbuseInfo>()

interface CacheEntry {
  data: AbuseInfo
  fetchedAt: number
}

function cacheKey(ip: string): string {
  return `abuseipdb:${ip}`
}

function readLocalStorage(ip: string): AbuseInfo | null {
  const raw = localStorage.getItem(cacheKey(ip))
  if (!raw) return null
  try {
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

function writeLocalStorage(ip: string, data: AbuseInfo): void {
  const entry: CacheEntry = { data, fetchedAt: Date.now() }
  localStorage.setItem(cacheKey(ip), JSON.stringify(entry))
}

export function getCachedAbuse(ip: string): AbuseInfo | null {
  const fromMemory = memoryCache.get(ip)
  if (fromMemory) return fromMemory
  const fromStorage = readLocalStorage(ip)
  if (fromStorage) memoryCache.set(ip, fromStorage)
  return fromStorage
}

export async function fetchAbuse(ip: string): Promise<AbuseInfo | null> {
  const cached = getCachedAbuse(ip)
  if (cached) return cached
  try {
    const res = await fetch(`/api/abuse?ip=${encodeURIComponent(ip)}`)
    if (!res.ok) return null
    const data = (await res.json()) as AbuseInfo
    memoryCache.set(ip, data)
    writeLocalStorage(ip, data)
    return data
  } catch {
    return null
  }
}
```

- [ ] **Step 14: Запустити тести, переконатись що всі проходять**

Run: `pnpm --filter @ipmap/web test -- abuseipdb`
Expected: PASS (11 tests)

- [ ] **Step 15: Типізація — перевірити проєкт**

Run: `pnpm --filter @ipmap/web type-check`
Expected: без помилок

- [ ] **Step 16: Commit**

```bash
git add apps/web/src/lib/abuseipdb.ts apps/web/src/lib/__tests__/abuseipdb.test.ts
git commit -m "feat: клієнтський модуль abuseipdb — валідація, парсинг, кеш з TTL"
```

---

### Task 2: Серверний route handler `/api/abuse`

**Files:**
- Create: `apps/web/src/app/api/abuse/route.ts`
- Create: `apps/web/.env.example`
- Test: `apps/web/src/app/api/abuse/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `isValidIpv4`, `extractAbuseInfo`, `AbuseInfo` з `@/lib/abuseipdb` (Task 1)
- Produces: `GET` route handler на `/api/abuse?ip=<ipv4>`, що повертає JSON `AbuseInfo` (200), або `{ error: string }` (400 невалідний IP, 500 не налаштовано ключ, 502 помилка апстріму)

- [ ] **Step 1: Написати тест на валідацію IP (400)**

```typescript
// apps/web/src/app/api/abuse/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('GET /api/abuse', () => {
  const originalKey = process.env.ABUSEIPDB_API_KEY

  beforeEach(() => {
    process.env.ABUSEIPDB_API_KEY = 'test-key'
  })
  afterEach(() => {
    process.env.ABUSEIPDB_API_KEY = originalKey
    vi.unstubAllGlobals()
  })

  it('повертає 400, якщо ip відсутній', async () => {
    const req = new NextRequest('http://localhost/api/abuse')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('повертає 400, якщо ip невалідний', async () => {
    const req = new NextRequest('http://localhost/api/abuse?ip=not-an-ip')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Запустити тест, переконатись що падає**

Run: `pnpm --filter @ipmap/web test -- route`
Expected: FAIL — `../route` module not found

- [ ] **Step 3: Реалізувати route handler**

```typescript
// apps/web/src/app/api/abuse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractAbuseInfo, isValidIpv4 } from '@/lib/abuseipdb'

export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get('ip')
  if (!ip || !isValidIpv4(ip)) {
    return NextResponse.json({ error: 'invalid ip' }, { status: 400 })
  }

  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AbuseIPDB не налаштовано' }, { status: 500 })
  }

  try {
    const upstream = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      { headers: { Key: apiKey, Accept: 'application/json' } },
    )
    if (!upstream.ok) {
      return NextResponse.json({ error: 'upstream error' }, { status: 502 })
    }
    const raw = await upstream.json()
    return NextResponse.json(extractAbuseInfo(raw))
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Запустити тести, переконатись що проходять**

Run: `pnpm --filter @ipmap/web test -- route`
Expected: PASS (2 tests)

- [ ] **Step 5: Написати тест на відсутній ключ (500)**

```typescript
it('повертає 500, якщо ABUSEIPDB_API_KEY не задано', async () => {
  delete process.env.ABUSEIPDB_API_KEY
  const req = new NextRequest('http://localhost/api/abuse?ip=8.8.8.8')
  const res = await GET(req)
  expect(res.status).toBe(500)
})
```

- [ ] **Step 6: Запустити тест, переконатись що проходить**

Run: `pnpm --filter @ipmap/web test -- route`
Expected: PASS (3 tests) — обробка вже реалізована в Step 3

- [ ] **Step 7: Створити `apps/web/.env.example`**

```
ABUSEIPDB_API_KEY=
```

- [ ] **Step 8: Типізація — перевірити проєкт**

Run: `pnpm --filter @ipmap/web type-check`
Expected: без помилок

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/api/abuse/route.ts apps/web/src/app/api/abuse/__tests__/route.test.ts apps/web/.env.example
git commit -m "feat: серверний proxy-роут /api/abuse для AbuseIPDB"
```

---

### Task 3: Секція AbuseIPDB у `BlockPanel.tsx`

**Files:**
- Modify: `apps/web/src/components/panels/BlockPanel.tsx`

**Interfaces:**
- Consumes: `fetchAbuse`, `getAbuseColor`, `type AbuseInfo` з `@/lib/abuseipdb` (Task 1)

- [ ] **Step 1: Додати імпорт і стан для abuse-даних**

У `apps/web/src/components/panels/BlockPanel.tsx` після існуючого імпорту RDAP:

```typescript
import { fetchAbuse, getAbuseColor, type AbuseInfo } from '@/lib/abuseipdb'
```

Усередині компонента `BlockPanel`, поруч з існуючими `info`/`loading` для RDAP:

```typescript
const [abuseInfo, setAbuseInfo] = useState<AbuseInfo | null>(null)
const [abuseLoading, setAbuseLoading] = useState(true)

useEffect(() => {
  setAbuseLoading(true)
  setAbuseInfo(null)
  fetchAbuse(block.start).then(data => {
    setAbuseInfo(data)
    setAbuseLoading(false)
  })
}, [block.start])
```

Цей `useEffect` окремий від RDAP-ефекту — щоб збій AbuseIPDB не блокував показ RDAP-даних.

- [ ] **Step 2: Додати секцію рендеру після блоку `info.registrationDate`**

У JSX, всередині `{!loading && info && (...)}`, ПІСЛЯ блоку `Виділено:` і ПЕРЕД закриваючим `</div>` цієї секції додати:

```tsx
<div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
  {abuseLoading && <div style={{ color: '#64748b', fontSize: 12 }}>Завантаження AbuseIPDB...</div>}
  {!abuseLoading && !abuseInfo && (
    <div style={{ color: '#64748b', fontSize: 12 }}>Abuse-дані недоступні</div>
  )}
  {!abuseLoading && abuseInfo && (
    <>
      <div>
        <span style={{ color: '#64748b' }}>Abuse score: </span>
        <span style={{ color: getAbuseColor(abuseInfo.score), fontWeight: 700 }}>
          {abuseInfo.score}%
        </span>
        <span style={{ color: '#64748b' }}> ({abuseInfo.totalReports} звітів)</span>
      </div>
      {abuseInfo.isp && (
        <div>
          <span style={{ color: '#64748b' }}>ISP: </span>
          <span>{abuseInfo.isp}</span>
        </div>
      )}
      <div>
        <span style={{ color: '#64748b' }}>Tor: </span>
        <span>{abuseInfo.isTor ? 'так' : 'ні'}</span>
      </div>
      {abuseInfo.lastReportedAt && (
        <div>
          <span style={{ color: '#64748b' }}>Останній звіт: </span>
          <span>{abuseInfo.lastReportedAt.slice(0, 10)}</span>
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Step 3: Типізація — перевірити проєкт**

Run: `pnpm --filter @ipmap/web type-check`
Expected: без помилок

- [ ] **Step 4: Ручна перевірка в браузері**

Переконатись, що `apps/web/.env.local` містить робочий `ABUSEIPDB_API_KEY` (не комітиться).

Run: `pnpm --filter @ipmap/web dev`

Відкрити `http://localhost:3000`, клікнути на країну, потім на кубик блоку. Очікується: у `BlockPanel` під RDAP-даними з'являється секція "Abuse score" з кольором відповідно до значення (перевірити на 2-3 різних блоках).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/panels/BlockPanel.tsx
git commit -m "feat: секція AbuseIPDB у BlockPanel"
```

---

### Task 4: Кольоровий бейдж у hover-тултипі блоку

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `getCachedAbuse`, `getAbuseColor` з `@/lib/abuseipdb` (Task 1)

- [ ] **Step 1: Додати імпорт**

У `apps/web/src/app/(dashboard)/page.tsx`:

```typescript
import { getCachedAbuse, getAbuseColor } from "@/lib/abuseipdb";
```

- [ ] **Step 2: Оновити рендер hover-тултипа блоку**

Замінити наявний блок (в `IpMapApp`, одразу перед блоком `{hoveredInfra && (...)}`):

```tsx
{hoveredBlock && (
  <div
    style={{
      position: "fixed",
      left: hoveredBlock.x + 14,
      top: hoveredBlock.y + 14,
      background: "rgba(0,0,0,0.78)",
      color: "#e2e8f0",
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 6,
      pointerEvents: "none",
      zIndex: 50,
      whiteSpace: "nowrap",
      border: "1px solid rgba(255,255,255,0.12)",
    }}
  >
    <div style={{ fontFamily: "monospace" }}>{hoveredBlock.block.start}</div>
    <div style={{ color: "#94a3b8" }}>
      {hoveredBlock.block.size.toLocaleString()} addresses
    </div>
  </div>
)}
```

на:

```tsx
{hoveredBlock && (() => {
  const abuse = getCachedAbuse(hoveredBlock.block.start);
  return (
    <div
      style={{
        position: "fixed",
        left: hoveredBlock.x + 14,
        top: hoveredBlock.y + 14,
        background: "rgba(0,0,0,0.78)",
        color: "#e2e8f0",
        fontSize: 12,
        padding: "6px 10px",
        borderRadius: 6,
        pointerEvents: "none",
        zIndex: 50,
        whiteSpace: "nowrap",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div style={{ fontFamily: "monospace" }}>{hoveredBlock.block.start}</div>
      <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
        {hoveredBlock.block.size.toLocaleString()} addresses
        {abuse && (
          <span
            title={`Abuse score: ${abuse.score}%`}
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: getAbuseColor(abuse.score),
            }}
          />
        )}
      </div>
    </div>
  );
})()}
```

Примітка: `getCachedAbuse` читає лише кеш (in-memory/`localStorage`), без мережевого запиту — крапка з'являється тільки для блоків, які вже перевіряли кліком раніше (Task 3).

- [ ] **Step 3: Типізація — перевірити проєкт**

Run: `pnpm --filter @ipmap/web type-check`
Expected: без помилок

- [ ] **Step 4: Ручна перевірка в браузері**

Run: `pnpm --filter @ipmap/web dev` (якщо ще не запущено)

1. Клікнути по блоку (щоб він потрапив у кеш через Task 3) → закрити панель.
2. Навести курсор на той самий кубик — переконатись, що поруч з "addresses" з'явилась кольорова крапка.
3. Навести курсор на кубик, який ще не клікали — переконатись, що крапки НЕМА (тільки IP і розмір).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/page.tsx"
git commit -m "feat: кольоровий abuse-бейдж у hover-тултипі блоку"
```

---

## Нотатка щодо реального API-ключа

Ключ `ABUSEIPDB_API_KEY` для локальної ручної перевірки (Task 3, Step 4) НЕ додається в цей файл і НЕ комітиться — покласти реальне значення в `apps/web/.env.local` (вже в `.gitignore`) окремо, поза цим планом.
