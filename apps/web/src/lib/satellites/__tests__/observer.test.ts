import { describe, it, expect } from 'vitest';
import type { SatOmm } from '@ipmap/types';
import { compressOmm } from '../omm';
import { createPropagator } from '../propagator';
import { visibleAbove, KREMENETS, sunElevationDeg, nextVisibleIssPass, type LookAngle } from '../observer';
import { getSunLatLng } from '@/lib/sun';
import fixture from '../__fixtures__/iss-omm.json';

const iss: SatOmm = compressOmm(fixture)[0];
const epochMs = Date.parse(iss.EPOCH);

const la = (e: number): LookAngle => ({ elevationDeg: e, azimuthDeg: 0, rangeKm: 1000 });

describe('lookAt / visibleAbove', () => {
  it('KREMENETS має очікувані координати', () => {
    expect(KREMENETS).toEqual({ lat: 50.1, lng: 25.73, altKm: 0 });
  });

  it('спостерігач під МКС бачить її майже в зеніті', () => {
    const p = createPropagator();
    p.load([iss]);
    const [lat, lng] = p.positionsAt(epochMs);
    const res = visibleAbove(p.lookAt(epochMs, { lat, lng, altKm: 0 }));
    expect(res.find((r) => r.index === 0)!.elevationDeg).toBeGreaterThan(85);
  });

  it('спостерігач в антиподі нічого не бачить', () => {
    const p = createPropagator();
    p.load([iss]);
    const [lat, lng] = p.positionsAt(epochMs);
    const anti = { lat: -lat, lng: lng > 0 ? lng - 180 : lng + 180, altKm: 0 };
    expect(visibleAbove(p.lookAt(epochMs, anti))).toEqual([]);
  });

  it('зіпсований запис дає null, індекси не зсуваються', () => {
    const p = createPropagator();
    p.load([{ ...iss, ECCENTRICITY: 5 }, iss]);
    const look = p.lookAt(epochMs, KREMENETS);
    expect(look).toHaveLength(2);
    expect(look[0]).toBeNull();
    expect(look[1]).not.toBeNull();
  });

  it('пропускає null, сортує за спаданням, поріг 10°', () => {
    const res = visibleAbove([la(20), null, la(9.9), la(45), la(10)]);
    expect(res.map((r) => r.index)).toEqual([3, 0, 4]);
    expect(res.map((r) => r.elevationDeg)).toEqual([45, 20, 10]);
  });
});

describe('sunElevationDeg', () => {
  const sun = getSunLatLng(new Date(epochMs));
  it('≈ 90° у підсонячній точці', () => {
    expect(sunElevationDeg({ lat: sun.lat, lng: sun.lng, altKm: 0 }, epochMs)).toBeCloseTo(90, 0);
  });
  it('≈ −90° в антиподі', () => {
    const anti = { lat: -sun.lat, lng: sun.lng > 0 ? sun.lng - 180 : sun.lng + 180, altKm: 0 };
    expect(Math.abs(sunElevationDeg(anti, epochMs) + 90)).toBeLessThan(0.5);
  });
});

describe('nextVisibleIssPass', () => {
  const p = createPropagator();
  p.load([iss]);
  const t = epochMs + 10 * 60_000;
  const [lat, lng] = p.positionsAt(t);
  const under = { lat, lng, altKm: 0 };
  const anti = { lat: -lat, lng: lng > 0 ? lng - 180 : lng + 180, altKm: 0 };

  it('знаходить проліт над підсупутниковою точкою', () => {
    const pass = nextVisibleIssPass(iss, under, epochMs, 1, () => true);
    expect(pass).not.toBeNull();
    expect(pass!.maxElevationDeg).toBeGreaterThan(80);
    expect(pass!.startMs).toBeLessThanOrEqual(t);
    expect(pass!.endMs).toBeGreaterThanOrEqual(t);
  });
  it('null, коли не темно', () => {
    expect(nextVisibleIssPass(iss, under, epochMs, 1, () => false)).toBeNull();
  });
  it('null в антиподі (не помилка)', () => {
    // Вікно 15 хв: за повний виток (~92 хв) МКС сама б пролетіла над антиподом
    expect(nextVisibleIssPass(iss, anti, epochMs, 0.25, () => true)).toBeNull();
  });
});
