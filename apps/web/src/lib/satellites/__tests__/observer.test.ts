import { describe, it, expect } from 'vitest';
import type { SatOmm } from '@ipmap/types';
import { compressOmm } from '../omm';
import { createPropagator } from '../propagator';
import { visibleAbove, KREMENETS, type LookAngle } from '../observer';
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
