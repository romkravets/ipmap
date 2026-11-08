# Живі шари: Крок 0 + шар «Супутники» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Винести шари глобуса в модульний інтерфейс `GlobeLayer` (крок 0) і першим новим шаром показати супутники (Starlink, МКС, GPS, OneWeb…) у реальному часі, з hover, лічильником і списком «над Кременцем зараз».

**Architecture:** Серверний роут `/api/satellites` кешує та стискає OMM JSON з CelesTrak. Браузер завантажує обрані групи, Web Worker раз на секунду рахує SGP4 (`satellite.js`) і віддає `Float32Array` (lat, lng, altKm); `SatellitesLayer` (реалізація `GlobeLayer`) інтерполює позиції між оновленнями й малює `THREE.Points`. `useGlobe.ts` лише реєструє шар через `LayerRegistry`.

**Tech Stack:** Next.js 14 (Route Handlers, `new Worker(new URL(...))`), Three.js 0.165, `satellite.js` (нова залежність), vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-08-live-layers-design.md` (розділи «0. Підготовка» і «B. Супутники»; шари A і C — окремі плани).

## Global Constraints

- Тільки **OMM JSON**, не TLE (6-значні NORAD-номери не влазять у TLE).
- Whitelist груп: `stations`, `starlink`, `oneweb`, `gps-ops`, `galileo`, `weather`; будь-що інше → `400` (роут не має бути відкритим проксі).
- CelesTrak: URL `https://celestrak.org/NORAD/elements/gp.php?GROUP=<group>&FORMAT=json`, кеш `fetch(..., { next: { revalidate: 7200 } })`. Браузер ходить лише в `/api/satellites` (CSP `connect-src` НЕ змінюється).
- Стиснута відповідь — лише поля: `OBJECT_NAME`, `NORAD_CAT_ID`, `EPOCH`, `MEAN_MOTION`, `ECCENTRICITY`, `INCLINATION`, `RA_OF_ASC_NODE`, `ARG_OF_PERICENTER`, `MEAN_ANOMALY`, `BSTAR`, `MEAN_MOTION_DOT`, `MEAN_MOTION_DDOT`.
- SGP4 — у Web Worker раз на 1 с; результат — `Float32Array` (lat, lng, altKm) через transferable. Радіус рендеру `r = 1 + altKm / 6371`; Tweaks-перемикач «перебільшити висоту ×3».
- `worker-src` у CSP: `'self' blob:`.
- За замовчуванням увімкнена лише група `stations`; Starlink — по кліку. GEO-супутників у v1 немає.
- Спостерігач «Кременець»: 50.10° N, 25.73° E; поріг видимості elevation > 10°.
- Коментарі та UI-тексти — українською, ідентифікатори — англійською (CLAUDE.md).
- Після змін у `packages/types/src/index.ts` — `pnpm --filter @ipmap/types build` (web бере типи з `dist/`, який у `.gitignore`).
- Коміт-повідомлення закінчувати рядком `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Існуючі шари (кабелі, ДЦ, IXP, кордони) НЕ переносити в нову архітектуру.

## Рішення плану (уточнення спеці — підтвердити під час рев'ю)

1. `LayerKey` розширюється лише на `"satellites"`. `"outages"`/`"phishing"` додадуть плани шарів A і C (інакше це ключі без шару).
2. До `GlobeLayer` додано необов'язкове `pickThreshold?: number` (поріг raycast для `Points`) — інтерфейс зі спеки інакше не дає шару налаштувати hover.
3. Registry оновлює (`update`) і опитує (`pick`) лише **видимі** шари.
4. Час шару = `Date.now()` + tweak `timeOffset` (години), як і для термінатора.
5. Швидкість у hover — наближена, колова: `sqrt(398600.4418 / (6371 + altKm))` км/с.
6. «Орбіта МКС ±1 виток (90 точок)» = 90 точок рівномірно на інтервалі `[now − T, now + T]`, `T = 1440 / MEAN_MOTION` хв; перерахунок раз на 60 с.
7. «Видимий проліт МКС» = elevation > 10° **і** Сонце на місці спостерігача нижче −6°; освітленість самого МКС (тінь Землі) у v1 НЕ перевіряється.
8. «Над Кременцем зараз» рахується в головному потоці **за кліком** (не інтервалом) для завантажених груп.
9. Висота спостерігача = 0 км.

## Review Focus

1. CelesTrak відповідає `200` з не-JSON (`No GP data found`) або порожнім масивом → роут `502`, а не `500`/порожній «успіх» у кеші.
2. `group=__proto__`, `constructor`, `STARLINK`, повторений `group=` → `400`.
3. Знятий з орбіти/зіпсований запис → `NaN` у буфері: точка невидима і не підсвічується в hover, решта індексів не зсувається.
4. Відповідь воркера із застарілим `gen` (група вимкнена/перезавантажена) ігнорується.
5. Перетин антимеридіана (lng 179.9 → −179.9) при інтерполяції не «пролітає» через глобус.

Також: порожній список «над Кременцем» і відсутність проліту МКС за 24 год — штатні результати, не помилки.

---

## Крок 0 — підготовка

### Task 1: Винести `latLngToVec3` і `greatCircleArc` у `lib/geo3d.ts`

**Files:**
- Create: `apps/web/src/lib/geo3d.ts`
- Modify: `apps/web/src/hooks/useGlobe.ts:10-33` (видалити локальні функції, додати `import { latLngToVec3, greatCircleArc } from "@/lib/geo3d"`)
- Test: `apps/web/src/lib/__tests__/geo3d.test.ts`

**Interfaces:**
- Produces:
  - `function latLngToVec3(lat: number, lng: number, r?: number): THREE.Vector3` (r = 1 за замовчуванням; та сама формула, що була в `useGlobe.ts`)
  - `function greatCircleArc(p1: THREE.Vector3, p2: THREE.Vector3, peakAlt: number, segments?: number): THREE.Vector3[]` (segments = 64)

- [ ] **Step 1: Write the failing test**

```ts
import * as THREE from 'three'
import { latLngToVec3, greatCircleArc } from '../geo3d'

describe('latLngToVec3', () => {
  it('(0,0) → +X, (90,0) → +Y, (0,90) → −Z', () => {
    expect(latLngToVec3(0, 0).distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-9)
    expect(latLngToVec3(90, 0).distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-9)
    expect(latLngToVec3(0, 90).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-9)
  })
  it('масштабує за r', () => {
    expect(latLngToVec3(30, 40, 1.5).length()).toBeCloseTo(1.5, 9)
  })
})

describe('greatCircleArc', () => {
  const a = latLngToVec3(0, 0), b = latLngToVec3(0, 90)
  it('segments+1 точок, кінці на сфері, середина на висоті 1+peak', () => {
    const pts = greatCircleArc(a, b, 0.2, 10)
    expect(pts).toHaveLength(11)
    expect(pts[0].length()).toBeCloseTo(1, 9)
    expect(pts[10].length()).toBeCloseTo(1, 9)
    expect(pts[5].length()).toBeCloseTo(1.2, 9)
  })
  it('за замовчуванням 65 точок', () => {
    expect(greatCircleArc(a, b, 0.1)).toHaveLength(65)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ipmap/web test -- geo3d`
Expected: FAIL — `../geo3d` не знайдено

- [ ] **Step 3: Створити `geo3d.ts`** — перенести обидві функції з `useGlobe.ts` без змін логіки; у `useGlobe.ts` замінити на імпорт.

- [ ] **Step 4: Run tests + type-check**

Run: `pnpm --filter @ipmap/web test && pnpm --filter @ipmap/web type-check`
Expected: усе PASS, без помилок типів

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/geo3d.ts apps/web/src/lib/__tests__/geo3d.test.ts apps/web/src/hooks/useGlobe.ts
git commit -m "refactor: винести latLngToVec3 і greatCircleArc в lib/geo3d"
```

### Task 2: Інтерфейс `GlobeLayer` і `LayerRegistry`

**Files:**
- Create: `apps/web/src/lib/layers/types.ts`, `apps/web/src/lib/layers/registry.ts`
- Test: `apps/web/src/lib/layers/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `InfraHoverInfo` з `@ipmap/types` (розширюється в Task 5).
- Produces:
  - `export type HoverInfo = InfraHoverInfo`
  - `export interface GlobeLayer<TData> { group: THREE.Group; pickThreshold?: number; setData(data: TData): void; update(dt: number, now: Date): void; pick?(hit: THREE.Intersection): HoverInfo | null; dispose(): void }`
  - `export interface LayerRegistry { add(key: string, layer: GlobeLayer<any>, scene: THREE.Scene): void; get<T>(key: string): GlobeLayer<T> | undefined; groups(): Record<string, THREE.Group>; update(dt: number, now: Date): void; pick(raycaster: THREE.Raycaster): HoverInfo | null; dispose(scene: THREE.Scene): void }`
  - `export function createLayerRegistry(): LayerRegistry`

- [ ] **Step 1: Write the failing tests** (`registry.test.ts`, фейкові шари на `THREE.Group`)
  - `add` кладе `layer.group` у `scene`; `groups()` повертає `{ [key]: group }`; `get(key)` повертає шар.
  - `update(0.1, now)` викликає `layer.update(0.1, now)` лише для шарів із `group.visible === true`.
  - `pick`: шар із `Mesh(BoxGeometry)` у групі, `Raycaster` з `(0,0,5)` у напрямку `(0,0,-1)` → повертає результат `layer.pick(hit)`; шар з `visible=false` пропускається; шар без `pick` пропускається; жоден не влучив → `null`.
  - `pick` виставляє `raycaster.params.Points.threshold = layer.pickThreshold` на час запиту й **повертає попереднє значення** (assert після виклику).
  - `dispose(scene)` викликає `layer.dispose()` кожного шару й знімає групи зі сцени.

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- registry` → FAIL (модуля нема)

- [ ] **Step 3: Implement** `createLayerRegistry` у `registry.ts` (Map ключ → шар; `pick` — `raycaster.intersectObjects(layer.group.children, true)[0]`), інтерфейси в `types.ts`.

- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test -- registry` → PASS

- [ ] **Step 5: Commit** `git add apps/web/src/lib/layers && git commit -m "feat: інтерфейс GlobeLayer і LayerRegistry"`

### Task 3: Загальний toggle у `useLayers` + ключ `satellites`

**Files:**
- Modify: `apps/web/src/hooks/useLayers.ts` (тип `LayerKey`, `LAYER_DEFAULTS`, `toggle`), `apps/web/src/components/panels/LayerTogglePanel.tsx` (`LAYERS`, `ACTIVE_COLORS`)
- Test: `apps/web/src/hooks/__tests__/useLayers.test.ts`

**Interfaces:**
- Produces: `LayerKey` тепер включає `"satellites"` (default `true`); `toggle(key)` встановлює `groups[key].visible = next[key]` для будь-якого ключа, що є в `window.globeLayerGroups`, і мовчки пропускає відсутні.

- [ ] **Step 1: Write the failing test** (`renderHook` з `@testing-library/react`)

```ts
it('toggle("satellites") вимикає групу з window.globeLayerGroups', () => {
  window.globeLayerGroups = { satellites: { visible: true }, cables: { visible: true } }
  window.globeLayers = undefined
  const { result } = renderHook(() => useLayerControls())
  act(() => result.current[1]('satellites'))
  expect(window.globeLayerGroups!.satellites.visible).toBe(false)
  expect(window.globeLayerGroups!.cables.visible).toBe(true)
})
it('існуючі ключі (cables/borders/datacenters/ixps) працюють як раніше', () => { /* toggle('cables') → cables.visible=false */ })
it('ключ без групи не кидає помилку', () => { window.globeLayerGroups = {}; /* toggle('satellites') не throw */ })
```

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- useLayers` → FAIL (`"satellites"` не в типі / група не змінюється)

- [ ] **Step 3: Implement** — замінити ланцюжок `if` у `toggle` на цикл/пошук за `key`; додати рядок `{ key: "satellites", label: "Satellites", icon: "✦" }` і колір `#e879f9` у `LayerTogglePanel`. `window.globeLayers`/`globeLayerGroups` типізувати як `Partial<Record<string, {visible: boolean}>>` де потрібно.

- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test && pnpm --filter @ipmap/web type-check` → PASS

- [ ] **Step 5: Commit** `git commit -m "feat: загальний toggle шарів + ключ satellites"` (файли: useLayers.ts, LayerTogglePanel.tsx, тест)

### Task 4: Підключити `LayerRegistry` у `useGlobe.ts`

**Files:**
- Modify: `apps/web/src/hooks/useGlobe.ts` (біля `window.globeLayerGroups = {...}` ~1087, `onCanvasMouseMove` ~1280, `animate()` ~1343, cleanup ~1492)

**Interfaces:**
- Consumes: `createLayerRegistry` (Task 2).
- Produces: у `useGlobe` змінна `registry: LayerRegistry`, доступна Task 10 для `registry.add(...)`.

Автотесту для `useGlobe` у репо нема; ціль задачі — нульова зміна поведінки. Верифікація ручна + type-check.

- [ ] **Step 1:** Створити `const registry = createLayerRegistry()` одразу після сцени; у `window.globeLayerGroups` додати `...registry.groups()`; початкову видимість груп реєстру брати з `window.globeLayers?.[key]` (як для `cables`).
- [ ] **Step 2:** У `animate()` після `controls.update()` викликати `registry.update(dt, new Date(Date.now() + (tweaks.timeOffset ?? 0) * 3_600_000))`.
- [ ] **Step 3:** У `onCanvasMouseMove` після IXP-гілки (перед фінальним `onInfraHover?.(null…)`): `const hit = registry.pick(raycaster); if (hit) { onInfraHover?.(hit, e.clientX, e.clientY); canvas.style.cursor = 'pointer'; return }`.
- [ ] **Step 4:** У cleanup додати `registry.dispose(scene)`.
- [ ] **Step 5: Verify**

Run: `pnpm --filter @ipmap/web type-check && pnpm --filter @ipmap/web test`
Expected: PASS. Потім `pnpm dev`, відкрити `http://localhost:3000`: глобус рендериться, перемикачі Cables / Data Centers / IXPs / Borders працюють, hover по ДЦ і IXP показує тултип, у консолі нема помилок.

- [ ] **Step 6: Commit** `git commit -m "refactor: useGlobe реєструє шари через LayerRegistry"`

---

## Шар B — Супутники

### Task 5: Типи, `lib/satellites/omm.ts`, залежність `satellite.js`

**Files:**
- Modify: `packages/types/src/index.ts` (типи нижче; розширити `InfraHoverInfo`), `apps/web/package.json` (залежність)
- Create: `apps/web/src/lib/satellites/omm.ts`, `apps/web/src/lib/satellites/__fixtures__/iss-omm.json`
- Test: `apps/web/src/lib/satellites/__tests__/omm.test.ts`

**Interfaces:**
- Produces (types):
  - `type SatelliteGroup = 'stations' | 'starlink' | 'oneweb' | 'gps-ops' | 'galileo' | 'weather'`
  - `interface SatOmm { OBJECT_NAME: string; NORAD_CAT_ID: number; EPOCH: string; MEAN_MOTION: number; ECCENTRICITY: number; INCLINATION: number; RA_OF_ASC_NODE: number; ARG_OF_PERICENTER: number; MEAN_ANOMALY: number; BSTAR: number; MEAN_MOTION_DOT: number; MEAN_MOTION_DDOT: number }`
  - `interface SatPosition { lat: number; lng: number; altKm: number }`
  - `interface SatHoverItem { name: string; noradId: number; altKm: number; speedKmS: number }`
  - `InfraHoverInfo` += `| { kind: 'satellite'; item: SatHoverItem }`
- Produces (omm.ts):
  - `const SATELLITE_GROUPS: readonly SatelliteGroup[]`
  - `function isSatelliteGroup(v: unknown): v is SatelliteGroup`
  - `const SAT_OMM_FIELDS: readonly (keyof SatOmm)[]`
  - `function compressOmm(raw: unknown): SatOmm[]`

- [ ] **Step 1: Встановити й перевірити бібліотеку**

Run: `pnpm --filter @ipmap/web add satellite.js` (обрати останню стабільну версію ≥ 2 тижні) 
Run: `node -e "const s=require('satellite.js');console.log(typeof s.json2satrec, typeof s.ecfToLookAngles)"` (якщо пакет ESM-only — `import()` в `node --input-type=module`)
Expected: `function function`. Якщо `json2satrec` немає — взяти версію, де він є.

- [ ] **Step 2:** Зберегти фікстуру: `curl 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json'` → `__fixtures__/iss-omm.json` (повний масив з одним ISS-записом, без стискання).

- [ ] **Step 3: Write the failing tests** (`omm.test.ts`)
  - `isSatelliteGroup`: `true` для кожної з 6 груп; `false` для `'foo'`, `'STARLINK'`, `'__proto__'`, `'constructor'`, `''`, `undefined`, `42`.
  - `compressOmm(fixture)`: повертає 1 запис, `Object.keys(r[0])` — рівно `SAT_OMM_FIELDS` (зайві поля відкинуті), `NORAD_CAT_ID` — number.
  - `compressOmm`: не-масив (`'No GP data found'`, `null`, `{}`) → `[]`; запис без числового `MEAN_MOTION` або з порожнім `OBJECT_NAME` відкидається, інші лишаються.
  - **Достатність полів:** `json2satrec(compressOmm(fixture)[0])` не кидає і `satrec.error === 0`. Якщо `json2satrec` вимагає додаткових полів (напр. `EPHEMERIS_TYPE`, `ELEMENT_SET_NO`) — додати їх у `SatOmm` і `SAT_OMM_FIELDS` і зазначити це в повідомленні коміту.

- [ ] **Step 4: Run** `pnpm --filter @ipmap/types build && pnpm --filter @ipmap/web test -- omm` → FAIL

- [ ] **Step 5: Implement** `omm.ts` (перевірка групи через `SATELLITE_GROUPS.includes`, НЕ через доступ за ключем об'єкта) і додати типи в `packages/types`.

- [ ] **Step 6: Run** `pnpm --filter @ipmap/types build && pnpm --filter @ipmap/web test -- omm && pnpm --filter @ipmap/web type-check` → PASS

- [ ] **Step 7: Commit** `git add packages/types apps/web/package.json pnpm-lock.yaml apps/web/src/lib/satellites && git commit -m "feat: типи супутників, OMM-стискання, залежність satellite.js"`

### Task 6: Роут `GET /api/satellites`

**Files:**
- Create: `apps/web/src/app/api/satellites/route.ts`
- Test: `apps/web/src/app/api/satellites/__tests__/route.test.ts` (стиль — як `api/abuse/__tests__/route.test.ts`: `NextRequest`, `vi.stubGlobal('fetch', …)`)

**Interfaces:**
- Consumes: `isSatelliteGroup`, `compressOmm`, `SAT_OMM_FIELDS` (Task 5).
- Produces: `GET(request: NextRequest): Promise<NextResponse>` → `200 SatOmm[]` | `400 { error: 'невалідна група' }` | `502 { error: 'помилка апстріму' }`.

- [ ] **Step 1: Write the failing tests**
  - `400`: `group` відсутній; `group=foo`; `group=__proto__`; `group=STARLINK`; `?group=starlink&group=gps-ops` (через `getAll(...).length !== 1`). У всіх випадках `fetch` НЕ викликано.
  - `200`: `fetch` змоканий масивом із ISS-фікстури + зайве поле `OBJECT_ID`; відповідь — масив, `Object.keys(body[0])` = `SAT_OMM_FIELDS`; `fetch` викликано з URL `https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json` і опцією `next: { revalidate: 7200 }` (`expect.objectContaining`).
  - `502`: апстрім `!ok`; апстрім кидає; тіло не-JSON (`text()` = `No GP data found`, `json()` кидає); парсинг дав порожній масив.

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- api/satellites` → FAIL

- [ ] **Step 3: Implement** `GET` у `route.ts` (за зразком `api/abuse/route.ts`; повідомлення про помилки українською).

- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test -- api/satellites` → PASS

- [ ] **Step 5: Commit** `git commit -m "feat: роут /api/satellites з whitelist груп і кешем CelesTrak"`

### Task 7: Обчислювач позицій `lib/satellites/propagator.ts`

**Files:**
- Create: `apps/web/src/lib/satellites/propagator.ts`
- Test: `apps/web/src/lib/satellites/__tests__/propagator.test.ts` (використовує ISS-фікстуру)

**Interfaces:**
- Consumes: `SatOmm`, `SatPosition` (Task 5), `satellite.js` (`json2satrec`, `propagate`, `gstime`, `eciToGeodetic`, `degreesLat`, `degreesLong`).
- Produces:
  - `interface Propagator { readonly size: number; load(omms: SatOmm[]): void; positionsAt(ms: number): Float32Array }` — буфер довжини `3 * size`, `[lat°, lng°, altKm]` на супутник; **індекс супутника у буфері = індекс у `omms`**; неможливий розрахунок → `NaN, NaN, NaN` для цього індексу.
  - `function createPropagator(): Propagator`
  - `function orbitTrack(omm: SatOmm, centerMs: number, points?: number): SatPosition[]` (points = 90; інтервал `[center − T, center + T]`, `T = 1440 / MEAN_MOTION` хв)

- [ ] **Step 1: Write the failing tests** (час — `Date.parse(fixture.EPOCH)`)

```ts
it('МКС на епосі: висота 350–450 км, |lat| ≤ 52°', () => {
  const p = createPropagator(); p.load([iss])
  const [lat, lng, alt] = p.positionsAt(epochMs)
  expect(alt).toBeGreaterThan(350); expect(alt).toBeLessThan(450)
  expect(Math.abs(lat)).toBeLessThanOrEqual(52); expect(Math.abs(lng)).toBeLessThanOrEqual(180)
})
it('зіпсований запис дає NaN, сусіди не зсуваються', () => {
  p.load([iss, { ...iss, ECCENTRICITY: 5 }, iss])
  const b = p.positionsAt(epochMs)
  expect(b).toHaveLength(9)
  expect(Number.isNaN(b[3])).toBe(true)
  expect(b[6]).toBeCloseTo(b[0], 4)
})
it('порожній load → буфер довжини 0', …)
it('orbitTrack: 90 скінченних точок, висота 350–450', …)
```

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- propagator` → FAIL

- [ ] **Step 3: Implement.** Запис, для якого `json2satrec` кидає, `satrec.error !== 0` або `propagate` повернув `false`, — `NaN`-трійка. Довгота нормалізована в [−180, 180].

- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test -- propagator` → PASS

- [ ] **Step 5: Commit** `git commit -m "feat: SGP4-обчислювач позицій супутників і орбіта МКС"`

### Task 8: `SatellitesLayer` — Points, інтерполяція, hover

**Files:**
- Create: `apps/web/src/lib/satellites/protocol.ts`, `apps/web/src/lib/layers/satellites.ts`
- Test: `apps/web/src/lib/layers/__tests__/satellites.test.ts` (фейковий воркер)

**Interfaces:**
- Consumes: `GlobeLayer`, `latLngToVec3`, `SatOmm`, `SatelliteGroup`, `SatHoverItem`.
- Produces (protocol.ts):
  - `type SatWorkerRequest = { type: 'load'; group: SatelliteGroup; gen: number; omms: SatOmm[] } | { type: 'unload'; group: SatelliteGroup } | { type: 'tick'; group: SatelliteGroup; gen: number; ms: number }`
  - `type SatWorkerResponse = { type: 'positions'; group: SatelliteGroup; gen: number; ms: number; positions: Float32Array }`
  - `interface SatWorkerPort { postMessage(msg: SatWorkerRequest): void; onmessage: ((e: { data: SatWorkerResponse }) => void) | null; terminate(): void }`
- Produces (layer):
  - `type SatelliteLayerData = Partial<Record<SatelliteGroup, SatOmm[]>>`
  - `class SatellitesLayer implements GlobeLayer<SatelliteLayerData> { constructor(createWorker: () => SatWorkerPort); setAltitudeScale(k: number): void }`
  - кольори груп: stations `#fde047`, starlink `#38bdf8`, oneweb `#a78bfa`, gps-ops `#4ade80`, galileo `#fb923c`, weather `#f472b6`; `pickThreshold = 0.01`.

Поведінка: `setData` — для кожної групи з **новим** (за посиланням) масивом: `gen++`, пост `load`, створити/замінити `THREE.Points` (колір групи, `sizeAttenuation: false`); групи, яких немає в даних, — `unload` + видалити Points + dispose. `update(dt, now)`: раз на 1 с (і лише якщо немає запиту «в польоті») постити `tick` з `ms = now + 1000`; на відповідь з актуальним `gen` — `prev ← поточні відображені`, `next ← нові` (при першій відповіді `prev = next`), `elapsed = 0`; позиції в буфері геометрії = лінійна інтерполяція в декартових координатах за `t = min(1, elapsed / 1 с)`. `NaN`-супутник → (0,0,0) і `pick` для нього повертає `null`. `pick(hit)` → `{ kind: 'satellite', item }`. `setAltitudeScale(k)` перераховує `r = 1 + k·altKm/6371` з збережених сирих буферів. `dispose()` — `terminate()` воркера + dispose геометрій/матеріалів.

- [ ] **Step 1: Write the failing tests** (фейковий `SatWorkerPort` збирає `postMessage`, тест викликає `port.onmessage({data})`)
  - `setData({ stations: [iss] })` постить `load` з `group:'stations'`, `omms`, `gen` і додає один `THREE.Points` у `layer.group`.
  - Відповідь `positions = [0, 0, 400]` + `update(1, now)` → атрибут `position` вершини 0 дорівнює `latLngToVec3(0, 0, 1 + 400/6371)` (похибка 1e-5).
  - `setAltitudeScale(3)` → `r = 1 + 3·400/6371`.
  - **Stale gen (Review Focus 4):** `setData` двічі (новий масив), відповідь зі старим `gen` → позиція лишається нульовою.
  - `setData({})` після `{stations}` постить `unload`, прибирає Points.
  - **NaN (Review Focus 3):** відповідь `[NaN, NaN, NaN]` → вершина (0,0,0); `pick` на цьому індексі → `null`.
  - **Антимеридіан (Review Focus 5):** відповіді `[0, 179.9, 400]`, потім `[0, -179.9, 400]`; `update(0.5, …)` → `x ≈ −(1 + 400/6371)` (±1e-3), а не ≈ 0.
  - `update` не постить другий `tick`, поки не прийшла відповідь на попередній; наступний `tick` — не раніше ніж через 1 с накопиченого `dt`.
  - `pick` для влучання в індекс 0 групи stations → `{ kind: 'satellite', item: { name, noradId, altKm ≈ 400, speedKmS ≈ 7.67 (±0.05) } }`.
  - `dispose()` викликає `terminate()`.

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- layers/satellites` → FAIL

- [ ] **Step 3: Implement** `protocol.ts` та `SatellitesLayer`.

- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test -- layers/satellites && pnpm --filter @ipmap/web type-check` → PASS

- [ ] **Step 5: Commit** `git commit -m "feat: SatellitesLayer — Points, інтерполяція, hover"`

### Task 9: Маркер МКС і лінія орбіти

**Files:**
- Modify: `apps/web/src/lib/layers/satellites.ts`
- Test: `apps/web/src/lib/layers/__tests__/satellites.test.ts` (додати кейси)

**Interfaces:**
- Consumes: `orbitTrack` (Task 7).
- Produces: `const ISS_NORAD_ID = 25544` (експорт); у `layer.group` — об'єкти з іменами `iss-marker` (`THREE.Points` з 1 вершиною, білий, більший розмір) і `iss-orbit` (`THREE.Line`, 90 вершин).

- [ ] **Step 1: Write the failing tests**
  - `setData({ stations: [issOmm] })` → `group.getObjectByName('iss-orbit')` — `THREE.Line` з 90 вершинами; `iss-marker` існує.
  - Після відповіді воркера й `update` позиція `iss-marker` збігається з вершиною МКС у Points групи.
  - Без запису з `NORAD_CAT_ID === 25544` — ні маркера, ні лінії.
  - Орбіта перераховується не частіше ніж раз на 60 с `now` (лічильник викликів `orbitTrack` через `vi.spyOn`/ін'єкцію) і при `setAltitudeScale`.
  - Якщо `stations` вимкнено — маркер і лінія зникають.

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** у `SatellitesLayer`.
- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test -- layers/satellites` → PASS
- [ ] **Step 5: Commit** `git commit -m "feat: маркер МКС і лінія орбіти"`

### Task 10: Web Worker, CSP, tweak і реєстрація шару в `useGlobe`

**Files:**
- Create: `apps/web/src/lib/satellites/workerCore.ts`, `apps/web/src/lib/satellites/sat.worker.ts`
- Modify: `apps/web/next.config.js` (`worker-src 'self' blob:`), `packages/types/src/index.ts` (`TweakValues.satAltExaggerate: boolean`), `apps/web/src/lib/constants.ts` (`satAltExaggerate: false`), `apps/web/src/components/panels/TweaksPanel.tsx` (рядок у списку Visibility: `['satAltExaggerate', 'Satellites ×3 altitude']`), `apps/web/src/hooks/useGlobe.ts` (опція `satellites?: SatelliteLayerData`), `apps/web/src/components/globe/GlobeScene.tsx` (проброс пропу `satellites`)
- Test: `apps/web/src/lib/satellites/__tests__/workerCore.test.ts`, `apps/web/src/__tests__/csp.test.ts`

**Interfaces:**
- Consumes: `createPropagator`, `SatWorkerRequest/Response`, `SatellitesLayer`, `registry` (Task 4).
- Produces: `function createWorkerCore(post: (res: SatWorkerResponse, transfer: Transferable[]) => void): (msg: SatWorkerRequest) => void`. `sat.worker.ts` — лише склейка: `self.onmessage` → `createWorkerCore((r, t) => self.postMessage(r, t))`.

- [ ] **Step 1: Write the failing tests**
  - `workerCore`: `load` (stations, gen 1, `[iss]`) потім `tick` (ms = епоха) → `post` викликано з `{type:'positions', group:'stations', gen:1, ms, positions}` (`length 3`), `transfer` містить `positions.buffer`; `tick` для невідомої групи → `post` не викликано, без throw; після `unload` `tick` → `post` не викликано; окремі групи не змішуються.
  - `csp.test.ts`: через `createRequire(import.meta.url)('../../next.config.js')`, `await cfg.headers()` → значення `Content-Security-Policy` містить `worker-src 'self' blob:` і НЕ містить жодного нового хоста в `connect-src` (assert, що `celestrak` у CSP відсутній).

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- workerCore csp` → FAIL

- [ ] **Step 3: Implement** `workerCore.ts`, `sat.worker.ts`, зміну CSP, tweak (тип + дефолт + UI).

- [ ] **Step 4: Підключити в `useGlobe.ts`:** `const satLayer = new SatellitesLayer(() => new Worker(new URL('../lib/satellites/sat.worker.ts', import.meta.url)) as unknown as SatWorkerPort)`; `registry.add('satellites', satLayer, scene)` (до `window.globeLayerGroups`); в `animate()` за зразком `lastCablesRef` — при зміні `optionsRef.current.satellites` викликати `satLayer.setData(...)`; при зміні `tweaks.satAltExaggerate` — `satLayer.setAltitudeScale(on ? 3 : 1)`.

- [ ] **Step 5: Verify**

Run: `pnpm --filter @ipmap/types build && pnpm --filter @ipmap/web test && pnpm --filter @ipmap/web type-check && pnpm --filter @ipmap/web build`
Expected: усе PASS, `next build` збирає воркер без помилок.

- [ ] **Step 6: Commit** `git commit -m "feat: Web Worker SGP4, CSP worker-src, tweak ×3, реєстрація шару"`

### Task 11: Завантаження даних, панель груп, лічильник, hover-тултип

**Files:**
- Create: `apps/web/src/lib/satellites/client.ts`, `apps/web/src/hooks/useSatelliteData.ts`, `apps/web/src/components/panels/SatellitePanel.tsx`
- Modify: `apps/web/src/lib/infraLabels.ts`, `apps/web/src/app/(dashboard)/page.tsx` (стан `enabledGroups` = `['stations']`, хук, пропи, `<SatellitePanel/>`, гілка `kind === 'satellite'` у тултипі)
- Test: `apps/web/src/lib/satellites/__tests__/client.test.ts`, `apps/web/src/hooks/__tests__/useSatelliteData.test.ts`, `apps/web/src/components/panels/__tests__/SatellitePanel.test.tsx`, `apps/web/src/lib/__tests__/infraLabels.test.ts` (додати кейс)

**Interfaces:**
- Consumes: `SatelliteLayerData`, `SATELLITE_GROUPS`, `useLayer('satellites')`.
- Produces:
  - `function fetchSatelliteGroup(group: SatelliteGroup): Promise<SatOmm[]>` — `GET /api/satellites?group=<group>`, кидає при `!ok`.
  - `function useSatelliteData(enabled: SatelliteGroup[]): { data: SatelliteLayerData; loading: SatelliteGroup[]; errors: Partial<Record<SatelliteGroup, string>> }` — кожна група завантажується один раз, кеш у `useRef`; вимкнена група зникає з `data`, але повторне вмикання не робить запит; після помилки наступне вмикання пробує знову.
  - `function formatSatelliteHover(item: SatHoverItem): { title: string; lines: string[] }`
  - `SatellitePanel` props: `{ enabled: SatelliteGroup[]; data: SatelliteLayerData; loading: SatelliteGroup[]; errors: Partial<Record<SatelliteGroup, string>>; onToggle(g: SatelliteGroup): void }` — рендериться лише коли `useLayer('satellites')`; позиція `bottom: 16px; left: 16px; z-index: 400`.

- [ ] **Step 1: Write the failing tests**
  - `client`: URL рівно `/api/satellites?group=starlink`; `502` → reject.
  - `useSatelliteData`: `enabled=['stations']` → 1 `fetch`; ререндер з тим самим → без нового; `['stations','starlink']` → +1; вимкнути й увімкнути `starlink` → без нового; після `reject` повторне вмикання → новий `fetch`, `errors.starlink` очищується при успіху.
  - `formatSatelliteHover({name:'ISS (ZARYA)', noradId:25544, altKm:417.3, speedKmS:7.66})` → `title 'ISS (ZARYA)'`, `lines` = `['NORAD 25544', 'Висота: 417 км', 'Швидкість: 7.66 км/с']`.
  - `SatellitePanel`: рендерить 6 чекбоксів груп; клік по Starlink викликає `onToggle('starlink')`; з `data.starlink` довжини 3 показує `Starlink на орбіті зараз: 3`; для групи з `errors` — текст помилки; при `loading` — індикатор; при вимкненому шарі `satellites` — нічого не рендерить.

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- satellites useSatelliteData SatellitePanel infraLabels` → FAIL

- [ ] **Step 3: Implement** модулі й підключити в `page.tsx` та `GlobeScene` (проп `satellites={data}`).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ipmap/web test && pnpm --filter @ipmap/web type-check`
Потім `pnpm dev` → `http://localhost:3000` (потрібен інтернет до CelesTrak): у Layers є Satellites; на глобусі видно точки станцій і МКС з лінією орбіти; hover по МКС показує назву, NORAD, висоту, швидкість; клік по Starlink у панелі додає хмару точок і лічильник; перемикач Tweaks «×3 altitude» піднімає оболонку; вимкнення Satellites ховає все; панель не перекриває LoadingBar/CountryPanel.

- [ ] **Step 5: Commit** `git commit -m "feat: панель груп супутників, завантаження даних, hover-тултип"`

### Task 12: «Над Кременцем зараз»

**Files:**
- Create: `apps/web/src/lib/satellites/observer.ts`
- Modify: `apps/web/src/lib/satellites/propagator.ts`, `apps/web/src/components/panels/SatellitePanel.tsx`
- Test: `apps/web/src/lib/satellites/__tests__/observer.test.ts`, `apps/web/src/components/panels/__tests__/SatellitePanel.test.tsx` (додати)

**Interfaces:**
- Consumes: `createPropagator`, ISS-фікстура.
- Produces:
  - `interface Observer { lat: number; lng: number; altKm: number }`; `const KREMENETS: Observer = { lat: 50.10, lng: 25.73, altKm: 0 }`
  - `interface LookAngle { elevationDeg: number; azimuthDeg: number; rangeKm: number }`
  - `Propagator.lookAt(ms: number, observer: Observer): (LookAngle | null)[]` (вирівняно за індексами; `null` для зіпсованих) — через `ecfToLookAngles`.
  - `function visibleAbove(look: (LookAngle | null)[], minElDeg?: number): { index: number; elevationDeg: number; azimuthDeg: number; rangeKm: number }[]` (minElDeg = 10; сортування за спаданням elevation)
  - `SatellitePanel` += проп `observer?: Observer` (default `KREMENETS`), `nowMs?: number` (default `Date.now()`); кнопка «Над Кременцем зараз» рахує в головному потоці за кліком по завантажених групах і виводить до 10 рядків «назва — elevation°».

- [ ] **Step 1: Write the failing tests**
  - Observer = підсупутникова точка МКС на епосі (з `positionsAt(epochMs)`, `altKm: 0`): `visibleAbove(p.lookAt(epochMs, observer))` містить індекс 0 з `elevationDeg > 85`.
  - Спостерігач у антиподі → результат `[]`.
  - `null` у вхідному масиві пропускається; відсортовано за спаданням; поріг 10° відсікає 9.9°.
  - Панель: клік по кнопці з `data.stations=[iss]`, `observer` = підсупутникова точка, `nowMs=epochMs` → рядок з `ISS`; з антиподом — текст `Зараз над Кременцем немає супутників вище 10°`; груп без даних немає → кнопка disabled.

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- observer SatellitePanel` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test -- observer SatellitePanel propagator` → PASS
- [ ] **Step 5: Commit** `git commit -m "feat: список супутників над Кременцем (elevation > 10°)"`

### Task 13: Найближчий видимий проліт МКС

**Files:**
- Modify: `apps/web/src/lib/satellites/observer.ts`, `apps/web/src/components/panels/SatellitePanel.tsx`
- Test: `apps/web/src/lib/satellites/__tests__/observer.test.ts` (додати)

**Interfaces:**
- Consumes: `createPropagator`, `getSunLatLng` з `@/lib/sun` (звірити сигнатуру перед використанням), `KREMENETS`.
- Produces:
  - `function sunElevationDeg(observer: Observer, ms: number): number` (= 90° − кутова відстань від спостерігача до підсонячної точки)
  - `interface IssPass { startMs: number; endMs: number; maxElevationDeg: number; maxElevationMs: number }`
  - `function nextVisibleIssPass(omm: SatOmm, observer: Observer, fromMs: number, hours?: number, isDark?: (ms: number) => boolean): IssPass | null` (hours = 24; крок 30 с; умова: elevation > 10° і `isDark(ms)`; `isDark` за замовчуванням `sunElevationDeg(observer, ms) < -6`)

- [ ] **Step 1: Write the failing tests**
  - `sunElevationDeg`: спостерігач у підсонячній точці на `ms` → ≈ 90; в антиподі → ≈ −90 (±0.5).
  - Спостерігач = підсупутникова точка МКС на `epochMs + 10 хв`, `fromMs = epochMs`, `hours = 1`, `isDark = () => true` → прохід знайдено: `maxElevationDeg > 80`, `startMs ≤ epochMs + 10 хв ≤ endMs`.
  - Те саме з `isDark = () => false` → `null`.
  - Спостерігач в антиподі → `null` (**нема проліту — не помилка**).
- Панель: рядок «Найближчий видимий проліт МКС: HH:MM–HH:MM (макс. N°)» часу в `Europe/Kyiv` (`toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' })`), якщо є МКС у `data.stations`; інакше `Видимих прольотів МКС найближчими 24 год немає`. Додати кейс у тест панелі з ін'єкцією `nowMs`.

- [ ] **Step 2: Run** `pnpm --filter @ipmap/web test -- observer SatellitePanel` → FAIL
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @ipmap/web test -- observer SatellitePanel` → PASS
- [ ] **Step 5: Commit** `git commit -m "feat: найближчий видимий проліт МКС над Кременцем"`

### Task 14: Фінальна верифікація

**Files:** без нових файлів (за потреби — `README.md`: рядок про шар супутників і джерело CelesTrak).

- [ ] **Step 1:** `pnpm --filter @ipmap/types build && pnpm --filter @ipmap/web test && pnpm --filter @ipmap/web type-check && pnpm --filter @ipmap/web build` → усе PASS.
- [ ] **Step 2:** Ручний прогін `pnpm dev`: сценарій із Task 11 Step 4 + списки з Task 12–13; увімкнути Starlink на слабшому профілі (DevTools → CPU 4× slowdown) — FPS глобуса прийнятний, головний потік не блокується; вимкнути Satellites — `Network`/Performance показує, що воркер більше не навантажує CPU (tick не постяться для невидимого шару).
- [ ] **Step 3:** Перевірити, що відповідь `/api/satellites?group=starlink` має лише поля зі `SAT_OMM_FIELDS`, а `/api/satellites?group=foo` → `400`.
- [ ] **Step 4: Commit** (якщо змінювався README) `git commit -m "docs: шар супутників у README"`
