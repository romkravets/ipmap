import * as THREE from 'three';
import type { SatOmm, SatelliteGroup } from '@ipmap/types';
import { latLngToVec3 } from '../geo3d';
import type { GlobeLayer, HoverInfo } from './types';
import type { SatWorkerPort, SatWorkerResponse } from '../satellites/protocol';
import { orbitTrack } from '../satellites/propagator';

export const ISS_NORAD_ID = 25544;

export type SatelliteLayerData = Partial<Record<SatelliteGroup, SatOmm[]>>;

const EARTH_R_KM = 6371;
const MU = 398600.4418;
const TICK_INTERVAL_S = 1;
const BOUNDING_RADIUS = 20;
const ORBIT_POINTS = 90;
const ORBIT_REFRESH_MS = 60_000;

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
  // МКС: маркер, лінія орбіти та кеш сирого треку (lat, lng, alt)
  private issMarker: THREE.Points | null = null;
  private issOrbit: THREE.Line | null = null;
  private issOmm: SatOmm | null = null;
  private orbitRaw: Float32Array | null = null;
  private orbitCenterMs: number | null = null;

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
      // Позиції змінюються щоразу — фіксована сфера, що покриває найвищу орбіту
      // (1 + 3·36000/6371 ≈ 18 з запасом), інакше Points.raycast відсікає MEO
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BOUNDING_RADIUS);
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
    this.syncIss();
  }

  setAltitudeScale(k: number): void {
    this.altScale = k;
    for (const st of this.states.values()) {
      if (!st.rawNext || !st.rawPrev) continue;
      this.toXyz(st.rawPrev, st.xyzPrev);
      this.toXyz(st.rawNext, st.xyzNext);
      this.writePositions(st);
    }
    this.rebuildOrbitGeometry();
    this.updateIssMarker();
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
    if (this.issOmm) {
      const t = now.getTime();
      if (this.orbitCenterMs === null || Math.abs(t - this.orbitCenterMs) >= ORBIT_REFRESH_MS) {
        this.orbitCenterMs = t;
        const track = orbitTrack(this.issOmm, t, ORBIT_POINTS);
        const raw = new Float32Array(ORBIT_POINTS * 3);
        track.forEach((p, i) => raw.set([p.lat, p.lng, p.altKm], i * 3));
        this.orbitRaw = raw;
        this.rebuildOrbitGeometry();
      }
    }
    this.updateIssMarker();
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
    this.syncIss();
  }

  private removeState(name: SatelliteGroup, st: GroupState): void {
    this.group.remove(st.points);
    st.points.geometry.dispose();
    (st.points.material as THREE.Material).dispose();
    this.states.delete(name);
    if (name === 'stations') this.syncIss();
  }

  // Створює/прибирає маркер і орбіту МКС залежно від наявності запису 25544 у stations
  private syncIss(): void {
    const omm = this.states.get('stations')?.omms.find((o) => o.NORAD_CAT_ID === ISS_NORAD_ID) ?? null;
    if (omm !== this.issOmm) {
      this.orbitRaw = null;
      this.orbitCenterMs = null;
    }
    this.issOmm = omm;
    if (!omm) {
      this.disposeIss();
      return;
    }
    if (!this.issMarker) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BOUNDING_RADIUS);
      const m = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 8, sizeAttenuation: false }));
      m.name = 'iss-marker';
      m.frustumCulled = false;
      m.visible = false;
      m.raycast = () => {}; // не перехоплює pick супутників
      this.issMarker = m;
      this.group.add(m);
    }
    if (!this.issOrbit) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ORBIT_POINTS * 3), 3));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BOUNDING_RADIUS);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }));
      l.name = 'iss-orbit';
      l.frustumCulled = false;
      l.visible = false;
      l.raycast = () => {};
      this.issOrbit = l;
      this.group.add(l);
    }
  }

  private disposeIss(): void {
    for (const o of [this.issMarker, this.issOrbit]) {
      if (!o) continue;
      this.group.remove(o);
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    this.issMarker = null;
    this.issOrbit = null;
    this.orbitRaw = null;
    this.orbitCenterMs = null;
  }

  // Проєкція кешованого треку з поточним масштабом висоти; нескінченні точки замінюємо попередньою
  private rebuildOrbitGeometry(): void {
    if (!this.issOrbit || !this.orbitRaw) return;
    const attr = this.issOrbit.geometry.getAttribute('position') as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    const raw = this.orbitRaw;
    let any = false;
    for (let i = 0; i < ORBIT_POINTS; i++) {
      const lat = raw[i * 3];
      const lng = raw[i * 3 + 1];
      const alt = raw[i * 3 + 2];
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(alt)) {
        const v = latLngToVec3(lat, lng, 1 + (this.altScale * alt) / EARTH_R_KM);
        out.set([v.x, v.y, v.z], i * 3);
        any = true;
      } else if (i > 0) {
        out.copyWithin(i * 3, (i - 1) * 3, i * 3);
      }
    }
    if (any) {
      // початкові нескінченні точки беруть першу скінченну
      const first = Array.from({ length: ORBIT_POINTS }, (_, i) => i).find((i) => Number.isFinite(raw[i * 3]) && Number.isFinite(raw[i * 3 + 1]) && Number.isFinite(raw[i * 3 + 2]))!;
      for (let i = 0; i < first; i++) out.copyWithin(i * 3, first * 3, first * 3 + 3);
    }
    this.issOrbit.visible = any;
    attr.needsUpdate = true;
  }

  // Маркер стоїть на вершині МКС у Points групи stations
  private updateIssMarker(): void {
    if (!this.issMarker) return;
    const st = this.states.get('stations');
    const idx = st && this.issOmm ? st.omms.indexOf(this.issOmm) : -1;
    if (!st || idx < 0 || !st.rawNext) {
      this.issMarker.visible = false;
      return;
    }
    const src = (st.points.geometry.getAttribute('position') as THREE.BufferAttribute).array;
    const attr = this.issMarker.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.array.set([src[idx * 3], src[idx * 3 + 1], src[idx * 3 + 2]]);
    attr.needsUpdate = true;
    this.issMarker.visible = Number.isFinite(st.rawNext[idx * 3 + 2]);
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
    this.updateIssMarker();
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
