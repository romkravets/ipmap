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

// Супутники з elevation >= minElDeg, від найвищого до найнижчого; null пропускаються
export function visibleAbove(look: (LookAngle | null)[], minElDeg = 10): VisibleSat[] {
  const out: VisibleSat[] = [];
  look.forEach((l, index) => {
    if (l && l.elevationDeg >= minElDeg) out.push({ index, ...l });
  });
  return out.sort((a, b) => b.elevationDeg - a.elevationDeg);
}
