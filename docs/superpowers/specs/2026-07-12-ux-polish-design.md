# UX-полірування: дата-центри/IXP tooltip, TweaksPanel хендл, block-маркери, click-outside

Дата: 2026-07-12

## Контекст

Чотири незалежні UX-правки, зафіксовані власником проєкту після огляду поточного стану глобуса:

1. Дата-центри, IXP та інші інфра-шари не мають жодного пояснення назви/характеристик — це просто кольорові крапки без інформації.
2. Панель налаштувань глобуса (`TweaksPanel`) при закритті повністю зникає з екрана; єдиний спосіб повернути — клавіша `E`, без видимого UI-хендла.
3. Маркери IP-блоків (рівень "Країна") — однорідні сині крапки без урахування розміру блоку, візуально майже не відрізняються від маркера сонця.
4. Закриття `BlockPanel` по кліку поза його межами не працює надійно. Це вже 3-тя спроба (коміти `c4a1155`, `b8ab37e`, `adba37b`) — усі три покладались на синхронізацію 3D raycasting hover-стану (`hoveredBlock`) з React state, що ненадійно за таймінгом.

## 1. Hover-тултип для дата-центрів та IXP

**Скоуп:** тільки дата-центри (`dcGroup`, 109 mesh) та IXP (`ixpGroup`/`ixpPoints`, 939 точок). Кабелі (`SubmarineCable`) — поза скоупом, лишаються суто візуальним шаром.

- В `useGlobe.ts`, у `onCanvasMouseMove`, після існуючої перевірки на блоки додається перевірка перетину з `dcGroup.children` (`raycaster.intersectObjects`) та з `ixpPoints` (`raycaster.intersectObject` з тим самим `threshold`-підходом, що вже використовується для блоків).
- Пріоритет hit-тестування: блоки → дата-центри → IXP → country dots (існуючий порядок для country dots зберігається останнім).
- Новий колбек в `UseGlobeOptions`:
  ```ts
  onInfraHover?: (info: { kind: 'datacenter'; item: DataCenter } | { kind: 'ixp'; item: IxPoint } | null, x: number, y: number) => void
  ```
- У `page.tsx`: новий state `hoveredInfra`, рендер тултипа в тому ж візуальному стилі, що й існуючий тултип блоків (`position: fixed`, зсув від курсора, `pointerEvents: none`):
  - **Data Center:** назва, провайдер (мапінг на людяну назву — `aws`→"Amazon AWS", `gcp`→"Google Cloud", `azure`→"Microsoft Azure", `equinix`→"Equinix", `other`→"Інший провайдер"), місто, країна.
  - **IXP:** назва, місто, країна, кількість мереж-учасників (`netCount`).
- Курсор → `pointer` при наведенні (як для блоків).

## 2. TweaksPanel — постійний хендл замість повного зникнення

- Замінити `if (!open) return null` на рендер малої кнопки-хендла, коли `open === false`.
- Хендл: та сама візуальна мова, що й кнопка "Layers" у `LayerTogglePanel` (висота 26px, скруглені кути, моноширинний шрифт, іконка), розміщується внизу справа (де зараз сама панель — `bottom: 16px; right: 16px`), щоб не перекривати `LayerTogglePanel` (той угорі справа).
- Іконка хендла — ⚙, підпис "Tweaks".
- Клік по хендлу → `setOpen(true)`.
- `✕` у шапці панелі й надалі викликає `setOpen(false)` (згортає до хендла, не видаляє нічого).
- Клавіша `E` продовжує працювати як alt-toggle (existing behavior не ламається).

## 3. Маркери IP-блоків — розмір і колір ∝ розмір блоку, з кільцем-підсвіткою

- Поточна реалізація: один `THREE.Points` на весь кластер блоків країни, однаковий розмір (`0.012`) і колір (`0x60a5fa`) для всіх — звідси схожість на маркер сонця.
- Нова реалізація (`buildBlockCluster` в `useGlobe.ts`) — перехід на індивідуальні `Mesh` (`CircleGeometry`) за зразком уже наявної архітектури country-маркерів (`dot` + `ring` на кожен `country`):
  - Радіус кожного блоку логарифмічно масштабується відносно `min(size)..max(size)` блоків поточної країни, в діапазоні, візуально узгодженому з country-маркерами (~0.006–0.020).
  - Колір — той самий HSL-градієнт холодний-синій (малий блок) → теплий жовтогарячий (великий блок), що вже використовується для country-маркерів (`setHSL(0.6 - logRatio*0.55, 0.9, 0.55)`), для єдиної візуальної мови в застосунку.
  - Кожен блок отримує `ring` (`RingGeometry`), прихований за замовчуванням (`visible = false`), який вмикається при hover або при selected (клікнутий) блоці — та сама техніка, що й `ring` у country-маркерів, лише керується станом hover/selected замість завжди-видимого.
- **Raycasting:** `onCanvasClick` і `onCanvasMouseMove` переходять з `raycaster.intersectObject(blockPoints)` (Points-based) на `raycaster.intersectObjects(blockMeshes)` (Mesh-based) — той самий надійний метод, що вже використовується для country dots і дата-центрів. Це усуває окремий клас багів, пов'язаних з `Points`-порогом (`threshold`).
- Дані для тултипа блоку (start + size) не змінюються — тільки візуальне представлення й метод raycasting.

## 4. Click-outside для BlockPanel — DOM-based підхід (заміна hover-based)

**Чому попередні 3 спроби не спрацювали:** усі покладались на `hoveredBlock` — React-стан, що оновлюється асинхронно через `mousemove` у 3D raycasting цикл. Закриття панелі залежало від того, чи встиг `mousemove` "перекрити" `hoveredBlock` у null до моменту `pointerdown`. Це давало неконсистентну поведінку (спрацьовує іноді, не спрацьовує в інших випадках — саме те, що зараз описав власник проєкту).

**Новий підхід:**
- `BlockPanel` отримує внутрішній `ref` на кореневий `div`.
- В `page.tsx` (або як окремий хук `useClickOutside` в `src/hooks/`) — `useEffect`, активний лише поки `selectedBlock !== null`:
  ```ts
  document.addEventListener('pointerdown', (e) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setSelectedBlock(null)
    }
  })
  ```
- Це повністю замінює `onCanvasPointerDown`/`hoveredBlock`-based gating: пропси `onCanvasPointerDown` в `GlobeScene`/`useGlobe` прибираються, `hoveredBlock` лишається виключно для тултипа (як і зараз), без ролі в закритті панелі.
- **Кейс "клік на інший блок":** `pointerdown` спершу закриє стару панель (ціль кліку — `<canvas>`, поза DOM `BlockPanel`), одразу після цього `click`-хендлер у `useGlobe.ts` (raycast) відкриє нову панель через `onBlockClick`. Візуально — панель миттєво перемикає вміст, без помітного мигання (обидві дії в межах одного click-жесту).
- ESC-хендлер (`window.addEventListener('keydown', ...)`) лишається без змін.

## Зачеплені файли

- `apps/web/src/hooks/useGlobe.ts` — raycasting для DC/IXP hover; перебудова `buildBlockCluster` на individual meshes + ring; оновлення `onCanvasClick`/`onCanvasMouseMove`.
- `apps/web/src/components/panels/TweaksPanel.tsx` — хендл замість `return null`.
- `apps/web/src/components/panels/BlockPanel.tsx` — `ref` на кореневий контейнер.
- `apps/web/src/app/(dashboard)/page.tsx` — click-outside `useEffect`, `hoveredInfra` state + тултип, прибрати `onCanvasPointerDown`/`handleCanvasPointerDown`.
- `packages/types/src/index.ts` — можливо, тип для `onInfraHover` payload (або визначити локально в `useGlobe.ts`).

## Поза скоупом

- Кабелі (`SubmarineCable`) — без interactivity.
- RDAP-подібна клік-панель для DC/IXP — тільки hover-тултип.
- Hilbert-розклад блоків, MaxMind-геолокація — не стосується цієї задачі (вже задокументовано як "на потім" в `CLAUDE.md`).
