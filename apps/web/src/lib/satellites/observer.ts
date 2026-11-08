import type { SatOmm } from "@ipmap/types";
import { getSunLatLng } from "@/lib/sun";
import { createPropagator } from "./propagator";

// Спостерігач на Землі (градуси та км) і відфільтрований список видимих супутників
export interface Observer {
  lat: number;
  lng: number;
  altKm: number;
}

export const KREMENETS: Observer = { lat: 50.1, lng: 25.73, altKm: 0 };

export interface LookAngle {
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
}

export interface VisibleSat extends LookAngle {
  index: number;
}

// Супутники з elevation > minElDeg, від найвищого до найнижчого; null пропускаються
export function visibleAbove(look: (LookAngle | null)[], minElDeg = 10): VisibleSat[] {
  const out: VisibleSat[] = [];
  look.forEach((l, index) => {
    if (l && l.elevationDeg > minElDeg) out.push({ index, ...l });
  });
  return out.sort((a, b) => b.elevationDeg - a.elevationDeg);
}

// Висота Сонця над горизонтом = 90° − кутова відстань до підсонячної точки
export function sunElevationDeg(observer: Observer, ms: number): number {
  const sun = getSunLatLng(new Date(ms));
  const rad = Math.PI / 180;
  const cos =
    Math.sin(observer.lat * rad) * Math.sin(sun.lat * rad) +
    Math.cos(observer.lat * rad) * Math.cos(sun.lat * rad) * Math.cos((observer.lng - sun.lng) * rad);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cos))) / rad;
}

export interface IssPass {
  startMs: number;
  endMs: number;
  maxElevationDeg: number;
  maxElevationMs: number;
}

const PASS_STEP_MS = 30_000;

// Перший безперервний відрізок, де МКС вище 10° і у спостерігача темно.
// Освітленість самої МКС (тінь Землі) у v1 свідомо не перевіряється.
export function nextVisibleIssPass(
  omm: SatOmm,
  observer: Observer,
  fromMs: number,
  hours = 24,
  isDark: (ms: number) => boolean = (ms) => sunElevationDeg(observer, ms) < -6,
): IssPass | null {
  const prop = createPropagator();
  prop.load([omm]);
  const endLimit = fromMs + hours * 3_600_000;
  let pass: IssPass | null = null;
  for (let ms = fromMs; ms <= endLimit; ms += PASS_STEP_MS) {
    const el = prop.lookAt(ms, observer)[0]?.elevationDeg;
    const ok = el !== undefined && el > 10 && isDark(ms);
    if (ok) {
      if (!pass) pass = { startMs: ms, endMs: ms, maxElevationDeg: el, maxElevationMs: ms };
      pass.endMs = ms;
      if (el > pass.maxElevationDeg) {
        pass.maxElevationDeg = el;
        pass.maxElevationMs = ms;
      }
    } else if (pass) {
      break;
    }
  }
  return pass;
}
