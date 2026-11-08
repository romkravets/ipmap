import type { SatOmm, SatelliteGroup } from '@ipmap/types'
import { compressOmm } from './omm'

// Серверний кеш: Next Data Cache не зберігає відповіді > 2 МБ (Starlink ≈ 4.7 МБ),
// тому тримаємо стиснутий масив у пам'яті процесу.
export const SAT_CACHE_TTL_MS = 7_200_000

const cache = new Map<SatelliteGroup, { at: number; data: SatOmm[] }>()
const inFlight = new Map<SatelliteGroup, Promise<SatOmm[]>>()

export function __resetSatelliteCacheForTests(): void {
  cache.clear()
  inFlight.clear()
}

async function fetchGroup(group: SatelliteGroup): Promise<SatOmm[]> {
  const upstream = await fetch(
    `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`,
    { cache: 'no-store' },
  )
  if (!upstream.ok) throw new Error(`upstream ${upstream.status}`)
  // CelesTrak може віддати 200 з не-JSON тілом ("No GP data found")
  const raw: unknown = JSON.parse(await upstream.text())
  const sats = compressOmm(raw)
  if (sats.length === 0) throw new Error('empty upstream')
  return sats
}

// Повертає дані групи або null, якщо апстрім недоступний і застарілого кешу немає
export async function getSatellites(group: SatelliteGroup): Promise<SatOmm[] | null> {
  const hit = cache.get(group)
  if (hit && Date.now() - hit.at < SAT_CACHE_TTL_MS) return hit.data

  let pending = inFlight.get(group)
  if (!pending) {
    pending = fetchGroup(group)
      .then((data) => {
        // кешуємо лише після успішного стискання непорожнього масиву
        cache.set(group, { at: Date.now(), data })
        return data
      })
      .finally(() => {
        inFlight.delete(group)
      })
    inFlight.set(group, pending)
  }
  try {
    return await pending
  } catch {
    // апстрім впав: віддаємо застарілі дані, якщо вони є
    return hit ? hit.data : null
  }
}
