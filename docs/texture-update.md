**Оновлення текстур — День / Ніч (2026-05-03)**

Коротко:

- Додано чисті day/night карти у 8K (Solar System Scope, CC BY 4.0): `earth-day-8k.jpg`, `earth-night-4k.jpg`.
- Залишено `earth-topo-4k.jpg` (NASA topo+bathy) як fallback.
- Налаштовано пріоритети завантаження у `apps/web/src/hooks/useGlobe.ts` (day → day-8k → topo → blue marble; night → night-8k → fallbacks).
- Додано ресемпл NPOT→POT та підбор потужності текстур у `useGlobe.ts` щоб mipmaps та anisotropy працювали коректно.
- Додано шари візуалізації: річки (Natural Earth 50m) та залізниці (Natural Earth 10m) як `LineSegments`.
- Додано скрипт `scripts/download-textures.mjs` та npm скрипт `dl-textures` у `package.json`.

Як перевірити локально:

1. Завантажити текстури (один раз):

```bash
cd /Users/romkravets/Documents/GitHub/sessionmap
node scripts/download-textures.mjs
```

2. Запустити dev сервер:

```bash
cd apps/web
npm run dev
# або: pnpm dl-textures && npm run dev
```

3. Оновити сторінку (hard refresh) — перевірити день/ніч, річки, залізниці, SeasonWidget (внизу праворуч).

Примітки:

- Нічна карта тепер 8K (8192×4096), якість значно краща.
- Денною картою є `earth-day-8k.jpg` (Solar System Scope) — вона має чистий океан (без рельєфного шуму) і гармоніює з нічною картою.
- Ліцензії: Solar System Scope textures — CC BY 4.0 (перевірити умови використання для публікацій/продажу), NASA — public domain.

Якщо потрібно — можу:

- додати приклади знімків екрана (порівняння до/після)
- додати тест, що перевіряє наявність файлів у `public/textures` під час CI (опційно)

---

Дата: 2026-05-03
Автор змін: локально оновлено скриптом/ручними правками (see git history).
