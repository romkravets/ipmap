import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { SatOmm } from '@ipmap/types';
import { SatellitesLayer, ISS_NORAD_ID } from '../satellites';
import { orbitTrack } from '../../satellites/propagator';
import { latLngToVec3 } from '../../geo3d';
import { compressOmm } from '../../satellites/omm';
import issRaw from '../../satellites/__fixtures__/iss-omm.json';
import type { SatWorkerPort, SatWorkerRequest } from '../../satellites/protocol';

function makeFake() {
  const sent: SatWorkerRequest[] = [];
  const port: SatWorkerPort = {
    postMessage: (m) => void sent.push(m),
    onmessage: null,
    terminate: vi.fn(),
  };
  return { port, sent };
}

vi.mock('../../satellites/propagator', async (orig) => {
  const actual = await orig<typeof import('../../satellites/propagator')>();
  return { ...actual, orbitTrack: vi.fn(actual.orbitTrack) };
});

const iss: SatOmm[] = compressOmm(issRaw);
const now = new Date('2026-11-08T05:00:00Z');

function setup() {
  const f = makeFake();
  const layer = new SatellitesLayer(() => f.port);
  layer.setData({ stations: iss });
  const loadMsg = f.sent[0] as Extract<SatWorkerRequest, { type: 'load' }>;
  const respond = (arr: number[], gen = loadMsg.gen, ms = 0) =>
    f.port.onmessage!({
      data: { type: 'positions', group: 'stations', gen, ms, positions: new Float32Array(arr) },
    });
  const pts = () => layer.group.children.find((c) => c.userData.group === 'stations') as THREE.Points;
  const pos = () => Array.from((pts().geometry.getAttribute('position') as THREE.BufferAttribute).array);
  return { ...f, layer, loadMsg, respond, pts, pos };
}

describe('SatellitesLayer', () => {
  it('постить load і додає Points', () => {
    const { sent, layer, loadMsg } = setup();
    expect(loadMsg).toMatchObject({ type: 'load', group: 'stations', omms: iss });
    expect(typeof loadMsg.gen).toBe('number');
    expect(layer.group.children.filter((c) => c.userData.group)).toHaveLength(1);
    expect(layer.group.children[0]).toBeInstanceOf(THREE.Points);
    expect(sent).toHaveLength(1);
  });

  it('позиція = latLngToVec3, масштаб висоти', () => {
    const { respond, layer, pos } = setup();
    respond([0, 0, 400]);
    layer.update(1, now);
    const e = latLngToVec3(0, 0, 1 + 400 / 6371);
    expect(pos()[0]).toBeCloseTo(e.x, 5);
    expect(pos()[1]).toBeCloseTo(e.y, 5);
    expect(pos()[2]).toBeCloseTo(e.z, 5);
    layer.setAltitudeScale(3);
    const e3 = latLngToVec3(0, 0, 1 + (3 * 400) / 6371);
    expect(pos()[0]).toBeCloseTo(e3.x, 5);
  });

  it('ігнорує відповідь із застарілим gen', () => {
    const { respond, layer, pos, loadMsg } = setup();
    layer.setData({ stations: [...iss] });
    respond([0, 0, 400], loadMsg.gen);
    layer.update(1, now);
    expect(pos()).toEqual([0, 0, 0]);
  });

  it('setData({}) постить unload і прибирає Points', () => {
    const { layer, sent } = setup();
    layer.setData({});
    expect(sent[sent.length - 1]).toEqual({ type: 'unload', group: 'stations' });
    expect(layer.group.children).toHaveLength(0);
  });

  it('NaN -> (0,0,0) і pick null', () => {
    const { respond, layer, pos, pts } = setup();
    respond([NaN, NaN, NaN]);
    layer.update(1, now);
    expect(pos()).toEqual([0, 0, 0]);
    expect(layer.pick({ object: pts(), index: 0 } as THREE.Intersection)).toBeNull();
  });

  it('антимеридіан: інтерполяція через декартові координати', () => {
    const { respond, layer, pos } = setup();
    respond([0, 179.9, 400]);
    respond([0, -179.9, 400]);
    layer.update(0.5, now);
    expect(pos()[0]).toBeCloseTo(-(1 + 400 / 6371), 2);
  });

  describe('розрив у часі та NaN', () => {
    it('відповідь із ms +10 с — snap до нової позиції, +1 с — інтерполяція', () => {
      const { respond, layer, pos } = setup();
      const a = latLngToVec3(0, 0, 1 + 400 / 6371);
      const b = latLngToVec3(0, 90, 1 + 400 / 6371);
      respond([0, 0, 400], undefined, 0);
      respond([0, 90, 400], undefined, 10_000);
      layer.update(0.5, now);
      expect(pos()[0]).toBeCloseTo(b.x, 5);
      expect(pos()[2]).toBeCloseTo(b.z, 5);
      respond([0, 0, 400], undefined, 11_000);
      layer.update(0.5, now);
      // зі snap-стану (b) до a за 1 с: середина
      expect(pos()[0]).toBeCloseTo((a.x + b.x) / 2, 5);
      expect(pos()[2]).toBeCloseTo((a.z + b.z) / 2, 5);
    });

    it('NaN -> валідна вершина без інтерполяції з початку координат', () => {
      const { respond, layer, pos } = setup();
      respond([NaN, NaN, NaN], undefined, 0);
      respond([0, 0, 400], undefined, 1000);
      layer.update(0.1, now);
      const e = latLngToVec3(0, 0, 1 + 400 / 6371);
      expect(pos()[0]).toBeCloseTo(e.x, 5);
      expect(pos()[2]).toBeCloseTo(e.z, 5);
    });

    it('валідна -> NaN вершина одразу (0,0,0)', () => {
      const { respond, layer, pos } = setup();
      respond([0, 0, 400], undefined, 0);
      respond([NaN, NaN, NaN], undefined, 1000);
      layer.update(0.1, now);
      expect(pos()).toEqual([0, 0, 0]);
    });
  });

  it('один tick у польоті; наступний не раніше ніж за 1 с', () => {
    const { layer, sent, respond } = setup();
    const ticks = () => sent.filter((m) => m.type === 'tick');
    layer.update(0.5, now);
    expect(ticks()).toHaveLength(0);
    layer.update(0.5, now);
    expect(ticks()).toHaveLength(1);
    expect((ticks()[0] as { ms: number }).ms).toBe(now.getTime() + 1000);
    layer.update(2, now);
    expect(ticks()).toHaveLength(1);
    respond([0, 0, 400]);
    layer.update(0.5, now);
    expect(ticks()).toHaveLength(2);
    respond([0, 0, 400]);
    layer.update(0.5, now);
    expect(ticks()).toHaveLength(2);
    layer.update(0.5, now);
    expect(ticks()).toHaveLength(3);
  });

  describe('збій воркера', () => {
    const ticks = (sent: SatWorkerRequest[]) => sent.filter((m) => m.type === 'tick');

    it('onerror скидає inFlight і попереджає', () => {
      const { layer, sent, port } = setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      layer.update(1, now);
      expect(ticks(sent)).toHaveLength(1);
      port.onerror!(new Error('boom'));
      expect(warn).toHaveBeenCalledWith('[satellites] worker error', expect.any(Error));
      layer.update(1, now);
      expect(ticks(sent)).toHaveLength(2);
      warn.mockRestore();
    });

    it('без відповіді tick повторюється після >5 с', () => {
      const { layer, sent } = setup();
      layer.update(1, now);
      expect(ticks(sent)).toHaveLength(1);
      layer.update(4, now);
      expect(ticks(sent)).toHaveLength(1);
      layer.update(1.5, now);
      expect(ticks(sent)).toHaveLength(2);
    });
  });

  it('pick повертає супутник; невідомі об’єкти/індекси -> null', () => {
    const { respond, layer, pts } = setup();
    respond([0, 0, 400]);
    const r = layer.pick({ object: pts(), index: 0 } as THREE.Intersection);
    expect(r).toMatchObject({ kind: 'satellite', item: { name: iss[0].OBJECT_NAME, noradId: iss[0].NORAD_CAT_ID } });
    if (r?.kind !== 'satellite') throw new Error('kind');
    expect(r.item.altKm).toBeCloseTo(400, 3);
    expect(r.item.speedKmS).toBeCloseTo(7.67, 1);
    expect(layer.pick({ object: pts(), index: 5 } as THREE.Intersection)).toBeNull();
    expect(layer.pick({ object: new THREE.Points(), index: 0 } as THREE.Intersection)).toBeNull();
  });

  it('raycast влучає в MEO-супутник поза малим колом навколо глобуса', () => {
    const { respond, layer, pts } = setup();
    const r = 1 + 20200 / 6371;
    respond([0, 0, 20200]);
    layer.update(1, now);
    const rc = new THREE.Raycaster(new THREE.Vector3(r, 0, 5), new THREE.Vector3(0, 0, -1));
    rc.params.Points = { threshold: layer.pickThreshold };
    const hits = rc.intersectObject(pts());
    expect(hits.length).toBeGreaterThan(0);
    expect(layer.pick(hits[0])).toMatchObject({ kind: 'satellite' });
  });

  it('dispose викликає terminate, повторний виклик безпечний', () => {
    const { layer, port } = setup();
    layer.dispose();
    expect(() => layer.dispose()).not.toThrow();
    expect(port.terminate).toHaveBeenCalledTimes(1);
  });

  describe('МКС', () => {
    const orbit = (l: SatellitesLayer) => l.group.getObjectByName('iss-orbit') as THREE.Line;
    const marker = (l: SatellitesLayer) => l.group.getObjectByName('iss-marker') as THREE.Points;
    const orbitPos = (l: SatellitesLayer) =>
      Array.from((orbit(l).geometry.getAttribute('position') as THREE.BufferAttribute).array);

    it('iss-orbit — Line з 90 вершинами, iss-marker існує', () => {
      const { layer } = setup();
      expect(ISS_NORAD_ID).toBe(25544);
      expect(orbit(layer)).toBeInstanceOf(THREE.Line);
      expect(orbit(layer).geometry.getAttribute('position').count).toBe(90);
      expect(marker(layer)).toBeInstanceOf(THREE.Points);
      expect(marker(layer).geometry.getAttribute('position').count).toBe(1);
    });

    it('після update орбіта скінченна, а маркер збігається з вершиною МКС', () => {
      const { layer, respond, pos } = setup();
      respond([10, 20, 400]);
      layer.update(1, now);
      const m = Array.from((marker(layer).geometry.getAttribute('position') as THREE.BufferAttribute).array);
      const idx = iss.findIndex((o) => o.NORAD_CAT_ID === ISS_NORAD_ID);
      expect(m).toEqual(pos().slice(idx * 3, idx * 3 + 3));
      expect(m).not.toEqual([0, 0, 0]);
      expect(orbitPos(layer).every(Number.isFinite)).toBe(true);
      expect(orbit(layer).visible).toBe(true);
    });

    it('без запису 25544 — ні маркера, ні лінії', () => {
      const f = makeFake();
      const layer = new SatellitesLayer(() => f.port);
      layer.setData({ stations: iss.map((o) => ({ ...o, NORAD_CAT_ID: 1 })) });
      expect(marker(layer)).toBeUndefined();
      expect(orbit(layer)).toBeUndefined();
    });

    it('орбіта перераховується раз на 60 с now і при setAltitudeScale', () => {
      const { layer, respond } = setup();
      respond([10, 20, 400]);
      const spy = vi.mocked(orbitTrack);
      spy.mockClear();
      layer.update(0.1, now);
      expect(spy).toHaveBeenCalledTimes(1);
      layer.update(0.1, new Date(now.getTime() + 30_000));
      expect(spy).toHaveBeenCalledTimes(1);
      layer.update(0.1, new Date(now.getTime() + 61_000));
      expect(spy).toHaveBeenCalledTimes(2);
      const before = orbitPos(layer);
      layer.setAltitudeScale(3);
      expect(orbitPos(layer)).not.toEqual(before);
      const r = (a: number[]) => Math.hypot(a[0], a[1], a[2]);
      expect(r(orbitPos(layer))).toBeGreaterThan(r(before));
    });

    it('при вимкненому stations маркер і лінія зникають, dispose їх чистить', () => {
      const { layer } = setup();
      const o = orbit(layer);
      const spy = vi.spyOn(o.geometry, 'dispose');
      layer.setData({});
      expect(marker(layer)).toBeUndefined();
      expect(orbit(layer)).toBeUndefined();
      expect(spy).toHaveBeenCalled();
      expect(layer.group.children).toHaveLength(0);
    });

    it('маркер і орбіта не перехоплюють raycast', () => {
      const { layer, respond } = setup();
      respond([0, 0, 400]);
      layer.update(1, now);
      const rc = new THREE.Raycaster(new THREE.Vector3(5, 0, 0), new THREE.Vector3(-1, 0, 0));
      rc.params.Points = { threshold: 0.5 };
      expect(rc.intersectObjects([marker(layer), orbit(layer)])).toHaveLength(0);
    });
  });
});
