import { describe, it, expect } from 'vitest';
import { json2satrec } from 'satellite.js';
import { SATELLITE_GROUPS, SAT_OMM_FIELDS, compressOmm, isSatelliteGroup } from '../omm';
import fixture from '../__fixtures__/iss-omm.json';

describe('isSatelliteGroup', () => {
  it.each(['stations', 'starlink', 'oneweb', 'gps-ops', 'galileo', 'weather'])('приймає %s', (g) => {
    expect(isSatelliteGroup(g)).toBe(true);
  });
  it.each(['foo', 'STARLINK', '__proto__', 'constructor', '', undefined, 42])('відхиляє %s', (v) => {
    expect(isSatelliteGroup(v)).toBe(false);
  });
  it('містить 6 груп', () => {
    expect(SATELLITE_GROUPS).toHaveLength(6);
  });
});

describe('compressOmm', () => {
  it('залишає лише потрібні поля', () => {
    const r = compressOmm(fixture);
    expect(r).toHaveLength(1);
    expect(Object.keys(r[0])).toEqual([...SAT_OMM_FIELDS]);
    expect(typeof r[0].NORAD_CAT_ID).toBe('number');
  });
  it.each(['No GP data found', null, {}])('не-масив %j -> []', (v) => {
    expect(compressOmm(v)).toEqual([]);
  });
  it('відкидає невалідні записи, решту лишає', () => {
    const good = fixture[0];
    const r = compressOmm([{ ...good, MEAN_MOTION: 'x' }, { ...good, OBJECT_NAME: '' }, good]);
    expect(r).toHaveLength(1);
  });
  it('поля достатні для json2satrec', () => {
    const satrec = json2satrec(compressOmm(fixture)[0]);
    expect(satrec.error).toBe(0);
  });
});
