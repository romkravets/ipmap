import {
  json2satrec, propagate, gstime, eciToGeodetic, eciToEcf, ecfToLookAngles,
  degreesLat, degreesLong, degreesToRadians, radiansToDegrees,
} from 'satellite.js';
import type { SatRec } from 'satellite.js';
import type { SatOmm, SatPosition } from '@ipmap/types';
import type { LookAngle, Observer } from './observer';

export interface Propagator {
  readonly size: number;
  load(omms: SatOmm[]): void;
  // Буфер довжини 3 * size: [lat°, lng°, altKm] на супутник; індекс = індекс в omms
  positionsAt(ms: number): Float32Array;
  // Кути спостереження за індексами; null для супутників, які неможливо розрахувати
  lookAt(ms: number, observer: Observer): (LookAngle | null)[];
}

// Запис, який неможливо розрахувати, позначається null (дає NaN-трійку)
function toSatrec(omm: SatOmm): SatRec | null {
  try {
    const rec = json2satrec(omm as unknown as Parameters<typeof json2satrec>[0]);
    return rec.error === 0 ? rec : null;
  } catch {
    return null;
  }
}

// Єдине місце перетворення SGP4 -> геодезичні координати; null при будь-якій невдачі
function geodeticAt(rec: SatRec, date: Date, gmst: number): SatPosition | null {
  try {
    const pv = propagate(rec, date);
    if (!pv || !pv.position) return null;
    const geo = eciToGeodetic(pv.position, gmst as ReturnType<typeof gstime>);
    const lat = degreesLat(geo.latitude);
    // Довгота нормалізується в [-180, 180]
    const lng = ((((degreesLong(geo.longitude) + 180) % 360) + 360) % 360) - 180;
    const altKm = geo.height;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(altKm)) return null;
    return { lat, lng, altKm };
  } catch {
    return null;
  }
}

export function createPropagator(): Propagator {
  let recs: (SatRec | null)[] = [];
  return {
    get size() {
      return recs.length;
    },
    load(omms) {
      recs = omms.map(toSatrec);
    },
    positionsAt(ms) {
      const out = new Float32Array(recs.length * 3);
      const date = new Date(ms);
      const gmst = gstime(date);
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i];
        const pos = rec ? geodeticAt(rec, date, gmst) : null;
        out[i * 3] = pos ? pos.lat : NaN;
        out[i * 3 + 1] = pos ? pos.lng : NaN;
        out[i * 3 + 2] = pos ? pos.altKm : NaN;
      }
      return out;
    },
    lookAt(ms, observer) {
      const date = new Date(ms);
      const gmst = gstime(date);
      // Спостерігач: геодезичні радіани та км
      const obs = {
        latitude: degreesToRadians(observer.lat),
        longitude: degreesToRadians(observer.lng),
        height: observer.altKm,
      };
      return recs.map((rec) => {
        if (!rec) return null;
        try {
          const pv = propagate(rec, date);
          if (!pv || !pv.position) return null;
          // ECI -> ECF (км) через gmst
          const ecf = eciToEcf(pv.position, gmst as ReturnType<typeof gstime>);
          const la = ecfToLookAngles(obs, ecf);
          const elevationDeg = radiansToDegrees(la.elevation);
          const azimuthDeg = radiansToDegrees(la.azimuth);
          const rangeKm = la.rangeSat;
          if (![elevationDeg, azimuthDeg, rangeKm].every(Number.isFinite)) return null;
          return { elevationDeg, azimuthDeg, rangeKm };
        } catch {
          return null;
        }
      });
    },
  };
}

// Орбіта на [center − T, center + T], T = 1440 / MEAN_MOTION хвилин (одна доба оборотів)
export function orbitTrack(omm: SatOmm, centerMs: number, points = 90): SatPosition[] {
  const rec = toSatrec(omm);
  const nan: SatPosition = { lat: NaN, lng: NaN, altKm: NaN };
  const halfMs = (1440 / omm.MEAN_MOTION) * 60_000;
  const start = centerMs - halfMs;
  const step = points > 1 ? (2 * halfMs) / (points - 1) : 0;
  const out: SatPosition[] = [];
  for (let i = 0; i < points; i++) {
    const date = new Date(start + i * step);
    out.push(rec ? (geodeticAt(rec, date, gstime(date)) ?? nan) : nan);
  }
  return out;
}
