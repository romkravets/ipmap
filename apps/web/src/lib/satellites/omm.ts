import type { SatOmm, SatelliteGroup } from '@ipmap/types';

export const SATELLITE_GROUPS: readonly SatelliteGroup[] = [
  'stations',
  'starlink',
  'oneweb',
  'gps-ops',
  'galileo',
  'weather',
];

// Перевірка через includes, а не за ключем об'єкта ('__proto__', 'constructor' відхиляються)
export function isSatelliteGroup(v: unknown): v is SatelliteGroup {
  return SATELLITE_GROUPS.includes(v as SatelliteGroup);
}

// Поля OMM, потрібні для json2satrec (порядок = порядок ключів у результаті)
export const SAT_OMM_FIELDS: readonly (keyof SatOmm)[] = [
  'OBJECT_NAME',
  'NORAD_CAT_ID',
  'EPOCH',
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER',
  'MEAN_ANOMALY',
  'BSTAR',
  'MEAN_MOTION_DOT',
  'MEAN_MOTION_DDOT',
];

// Стискає сирий JSON CelesTrak до потрібних полів; невалідні записи відкидає
export function compressOmm(raw: unknown): SatOmm[] {
  if (!Array.isArray(raw)) return [];
  const out: SatOmm[] = [];
  for (const rec of raw) {
    if (!rec || typeof rec !== 'object') continue;
    const r = rec as Record<string, unknown>;
    if (typeof r.MEAN_MOTION !== 'number' || !Number.isFinite(r.MEAN_MOTION)) continue;
    if (typeof r.OBJECT_NAME !== 'string' || r.OBJECT_NAME === '') continue;
    const picked: Record<string, unknown> = {};
    for (const f of SAT_OMM_FIELDS) picked[f] = r[f];
    out.push(picked as unknown as SatOmm);
  }
  return out;
}
