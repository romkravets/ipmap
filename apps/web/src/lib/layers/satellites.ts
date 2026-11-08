import * as THREE from 'three';
import type { SatOmm, SatelliteGroup } from '@ipmap/types';
import { latLngToVec3 } from '../geo3d';
import type { GlobeLayer, HoverInfo } from './types';
import type { SatWorkerPort, SatWorkerResponse } from '../satellites/protocol';

export type SatelliteLayerData = Partial<Record<SatelliteGroup, SatOmm[]>>;

const EARTH_R_KM = 6371;
const MU = 398600.4418;
const TICK_INTERVAL_S = 1;

const GROUP_COLORS: Record<SatelliteGroup, string> = {
  stations: '#fde047',
  starlink: '#38bdf8',
  oneweb: '#a78bfa',
  'gps-ops': '#4ade80',
  galileo: '#fb923c',
  weather: '#f472b6',
};

interface GroupState {
  omms: SatOmm[];
  gen: number;
  points: THREE.Points;
  // Сирі (lat, lng, alt) попереднього/наступного тіку
  rawPrev: Float32Array | null;
  rawNext: Float32Array | null;
  // Декартові координати prev/next (з урахуванням масштабу висоти)
  xyzPrev: Float32Array;
  xyzNext: Float32Array;
  elapsed: number;
  sinceTick: number;
  inFlight: boolean;
}

export class SatellitesLayer implements GlobeLayer<SatelliteLayerData> {
  readonly group = new THREE.Group();
  readonly pickThreshold = 0.01;

  private readonly worker: SatWorkerPort;
  private readonly states = new Map<SatelliteGroup, GroupState>();
  // Лічильники gen переживають unload, щоб старі відповіді не збігалися з новими
  private readonly genCounters = new Map<SatelliteGroup, number>();
  private altScale = 1;
  private disposed = false;

  constructor(createWorker: () => SatWorkerPort) {
    this.worker = createWorker();
    this.worker.onmessage = (e) => this.onResponse(e.data);
  }

  setData(data: SatelliteLayerData): void {
    for (const [name, st] of [...this.states]) {
      if (!data[name]) {
        this.worker.postMessage({ type: 'unload', group: name });
        this.removeState(name, st);
      }
    }
    for (const name of Object.keys(data) as SatelliteGroup[]) {
      const omms = data[name];
      if (!omms) continue;
      const existing = this.states.get(name);
      if (existing && existing.omms === omms) continue;
      if (existing) this.removeState(name, existing);

      const gen = (this.genCounters.get(name) ?? 0) + 1;
      this.genCounters.set(name, gen);
      const n = omms.length;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      // Позиції змінюються щоразу — фіксована сфера із запасом замість перерахунку
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
      const material = new THREE.PointsMaterial({
        color: GROUP_COLORS[name],
        size: 3,
        sizeAttenuation: false,
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.userData.group = name;
      this.group.add(points);
      this.states.set(name, {
        omms,
        gen,
        points,
        rawPrev: null,
        rawNext: null,
        xyzPrev: new Float32Array(n * 3),
        xyzNext: new Float32Array(n * 3),
        elapsed: 0,
        sinceTick: 0,
        inFlight: false,
      });
      this.worker.postMessage({ type: 'load', group: name, gen, omms });
    }
  }

  setAltitudeScale(k: number): void {
    this.altScale = k;
    for (const st of this.states.values()) {
      if (!st.rawNext || !st.rawPrev) continue;
      this.toXyz(st.rawPrev, st.xyzPrev);
      this.toXyz(st.rawNext, st.xyzNext);
      this.writePositions(st);
    }
  }

  update(dt: number, now: Date): void {
    for (const [name, st] of this.states) {
      st.elapsed += dt;
      st.sinceTick += dt;
      if (!st.inFlight && st.sinceTick >= TICK_INTERVAL_S) {
        st.inFlight = true;
        st.sinceTick = 0;
        this.worker.postMessage({ type: 'tick', group: name, gen: st.gen, ms: now.getTime() + 1000 });
      }
      if (st.rawNext) this.writePositions(st);
    }
  }

  pick(hit: THREE.Intersection): HoverInfo | null {
    const name = hit.object.userData?.group as SatelliteGroup | undefined;
    const idx = hit.index;
    if (!name || idx === undefined) return null;
    const st = this.states.get(name);
    if (!st || st.points !== hit.object || !st.rawNext) return null;
    const omm = st.omms[idx];
    if (!omm) return null;
    const lat = st.rawNext[idx * 3];
    const lng = st.rawNext[idx * 3 + 1];
    const altKm = st.rawNext[idx * 3 + 2];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(altKm)) return null;
    // Колова орбіта як наближення швидкості
    const speedKmS = Math.sqrt(MU / (EARTH_R_KM + altKm));
    return { kind: 'satellite', item: { name: omm.OBJECT_NAME, noradId: omm.NORAD_CAT_ID, altKm, speedKmS } };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate();
    this.worker.onmessage = null;
    for (const [name, st] of [...this.states]) this.removeState(name, st);
  }

  private removeState(name: SatelliteGroup, st: GroupState): void {
    this.group.remove(st.points);
    st.points.geometry.dispose();
    (st.points.material as THREE.Material).dispose();
    this.states.delete(name);
  }

  private onResponse(msg: SatWorkerResponse): void {
    if (msg.type !== 'positions') return;
    const st = this.states.get(msg.group);
    if (!st || st.gen !== msg.gen) return;
    st.inFlight = false;
    if (msg.positions.length < st.omms.length * 3) return;
    const next = msg.positions;
    const first = st.rawNext === null;
    if (!first) {
      // prev ← поточні відображені позиції (без стрибків)
      this.currentXyz(st, st.xyzPrev);
      st.rawPrev = st.rawNext;
    } else {
      st.rawPrev = next;
    }
    st.rawNext = next;
    this.toXyz(next, st.xyzNext);
    if (first) st.xyzPrev.set(st.xyzNext);
    st.elapsed = 0;
    this.writePositions(st);
  }

  // Лінійна інтерполяція в декартових координатах (безпечна на антимеридіані)
  private currentXyz(st: GroupState, out: Float32Array): void {
    const t = Math.min(1, st.elapsed / TICK_INTERVAL_S);
    for (let i = 0; i < out.length; i++) {
      out[i] = st.xyzPrev[i] + (st.xyzNext[i] - st.xyzPrev[i]) * t;
    }
  }

  private toXyz(raw: Float32Array, out: Float32Array): void {
    const n = out.length / 3;
    for (let i = 0; i < n; i++) {
      const lat = raw[i * 3];
      const lng = raw[i * 3 + 1];
      const alt = raw[i * 3 + 2];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(alt)) {
        out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = 0;
        continue;
      }
      const v = latLngToVec3(lat, lng, 1 + (this.altScale * alt) / EARTH_R_KM);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
  }

  private writePositions(st: GroupState): void {
    const attr = st.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.currentXyz(st, attr.array as Float32Array);
    attr.needsUpdate = true;
  }
}
