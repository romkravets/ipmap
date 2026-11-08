import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { SatOmm } from '@ipmap/types';
import { SatellitesLayer } from '../satellites';
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

const iss: SatOmm[] = compressOmm(issRaw);
const now = new Date('2026-11-08T05:00:00Z');

function setup() {
  const f = makeFake();
  const layer = new SatellitesLayer(() => f.port);
  layer.setData({ stations: iss });
  const loadMsg = f.sent[0] as Extract<SatWorkerRequest, { type: 'load' }>;
  const respond = (arr: number[], gen = loadMsg.gen) =>
    f.port.onmessage!({
      data: { type: 'positions', group: 'stations', gen, ms: 0, positions: new Float32Array(arr) },
    });
  const pts = () => layer.group.children[0] as THREE.Points;
  const pos = () => Array.from((pts().geometry.getAttribute('position') as THREE.BufferAttribute).array);
  return { ...f, layer, loadMsg, respond, pts, pos };
}

describe('SatellitesLayer', () => {
  it('постить load і додає Points', () => {
    const { sent, layer, loadMsg } = setup();
    expect(loadMsg).toMatchObject({ type: 'load', group: 'stations', omms: iss });
    expect(typeof loadMsg.gen).toBe('number');
    expect(layer.group.children).toHaveLength(1);
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

  it('dispose викликає terminate, повторний виклик безпечний', () => {
    const { layer, port } = setup();
    layer.dispose();
    expect(() => layer.dispose()).not.toThrow();
    expect(port.terminate).toHaveBeenCalledTimes(1);
  });
});
