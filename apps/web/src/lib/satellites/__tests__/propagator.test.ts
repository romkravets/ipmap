import { describe, it, expect } from 'vitest';
import type { SatOmm } from '@ipmap/types';
import { compressOmm } from '../omm';
import { createPropagator, orbitTrack } from '../propagator';
import fixture from '../__fixtures__/iss-omm.json';

const iss: SatOmm = compressOmm(fixture)[0];
const epochMs = Date.parse(iss.EPOCH);

describe('createPropagator', () => {
  it('МКС на епосі: висота 350–450 км, |lat| ≤ 52°', () => {
    const p = createPropagator();
    p.load([iss]);
    expect(p.size).toBe(1);
    const [lat, lng, alt] = p.positionsAt(epochMs);
    expect(alt).toBeGreaterThan(350);
    expect(alt).toBeLessThan(450);
    expect(Math.abs(lat)).toBeLessThanOrEqual(52);
    expect(Math.abs(lng)).toBeLessThanOrEqual(180);
  });

  it('зіпсований запис дає NaN, сусіди не зсуваються', () => {
    const p = createPropagator();
    p.load([iss, { ...iss, ECCENTRICITY: 5 }, iss]);
    const b = p.positionsAt(epochMs);
    expect(b).toHaveLength(9);
    expect(Number.isNaN(b[3])).toBe(true);
    expect(Number.isNaN(b[4])).toBe(true);
    expect(Number.isNaN(b[5])).toBe(true);
    expect(b[6]).toBeCloseTo(b[0], 4);
  });

  it('порожній load → буфер довжини 0', () => {
    const p = createPropagator();
    p.load([]);
    expect(p.size).toBe(0);
    expect(p.positionsAt(epochMs)).toHaveLength(0);
  });

  it('запис, для якого json2satrec кидає, дає NaN і не кидає назовні', () => {
    const p = createPropagator();
    p.load([{ ...iss, EPOCH: undefined as unknown as string }, iss]);
    const b = p.positionsAt(epochMs);
    expect(Number.isNaN(b[0])).toBe(true);
    expect(Number.isFinite(b[3])).toBe(true);
  });

  it('повертає новий буфер при кожному виклику', () => {
    const p = createPropagator();
    p.load([iss]);
    expect(p.positionsAt(epochMs)).not.toBe(p.positionsAt(epochMs));
  });
});

describe('orbitTrack', () => {
  it('90 скінченних точок, висота 350–450', () => {
    const t = orbitTrack(iss, epochMs);
    expect(t).toHaveLength(90);
    for (const pt of t) {
      expect(Number.isFinite(pt.lat)).toBe(true);
      expect(Number.isFinite(pt.lng)).toBe(true);
      expect(pt.altKm).toBeGreaterThan(350);
      expect(pt.altKm).toBeLessThan(450);
    }
  });

  it('зіпсований запис → точки NaN, без винятків', () => {
    const t = orbitTrack({ ...iss, ECCENTRICITY: 5 }, epochMs, 5);
    expect(t).toHaveLength(5);
    expect(Number.isNaN(t[0].lat)).toBe(true);
  });
});
