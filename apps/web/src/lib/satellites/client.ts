import type { SatOmm, SatelliteGroup } from '@ipmap/types'

// Завантажує OMM-записи однієї групи через власний API-роут
export async function fetchSatelliteGroup(group: SatelliteGroup): Promise<SatOmm[]> {
  const res = await fetch(`/api/satellites?group=${group}`)
  if (!res.ok) throw new Error(`satellites ${group}: HTTP ${res.status}`)
  return (await res.json()) as SatOmm[]
}
