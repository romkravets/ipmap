import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { DataCenter } from '@ipmap/types';
import { createLayerRegistry } from '../registry';
import type { GlobeLayer, HoverInfo } from '../types';

const dc = { id: 'x' } as unknown as DataCenter;
const info: HoverInfo = { kind: 'datacenter', item: dc };

function fakeLayer(opts: { withMesh?: boolean; pick?: boolean; threshold?: number } = {}) {
  const group = new THREE.Group();
  if (opts.withMesh) group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  const layer: GlobeLayer<unknown> = {
    group,
    pickThreshold: opts.threshold,
    setData: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
    ...(opts.pick === false ? {} : { pick: vi.fn(() => info) }),
  };
  return layer;
}

const ray = () =>
  new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));

describe('LayerRegistry', () => {
  it('add кладе групу в сцену; groups/get працюють', () => {
    const reg = createLayerRegistry();
    const scene = new THREE.Scene();
    const l = fakeLayer();
    reg.add('a', l, scene);
    expect(scene.children).toContain(l.group);
    expect(reg.groups()).toEqual({ a: l.group });
    expect(reg.get('a')).toBe(l);
    expect(reg.get('nope')).toBeUndefined();
  });

  it('update викликає лише видимі шари', () => {
    const reg = createLayerRegistry();
    const scene = new THREE.Scene();
    const a = fakeLayer();
    const b = fakeLayer();
    b.group.visible = false;
    reg.add('a', a, scene);
    reg.add('b', b, scene);
    const now = new Date();
    reg.update(0.1, now);
    expect(a.update).toHaveBeenCalledWith(0.1, now);
    expect(b.update).not.toHaveBeenCalled();
  });

  it('pick повертає результат layer.pick', () => {
    const reg = createLayerRegistry();
    const l = fakeLayer({ withMesh: true });
    reg.add('a', l, new THREE.Scene());
    expect(reg.pick(ray())).toBe(info);
    expect(l.pick).toHaveBeenCalled();
  });

  it('pick пропускає невидимі шари та шари без pick; без влучань -> null', () => {
    const reg = createLayerRegistry();
    const scene = new THREE.Scene();
    const hidden = fakeLayer({ withMesh: true });
    hidden.group.visible = false;
    const noPick = fakeLayer({ withMesh: true, pick: false });
    const empty = fakeLayer();
    reg.add('h', hidden, scene);
    reg.add('n', noPick, scene);
    reg.add('e', empty, scene);
    expect(reg.pick(ray())).toBeNull();
    expect(hidden.pick).not.toHaveBeenCalled();
  });

  it('pick виставляє Points.threshold на час запиту й відновлює попереднє', () => {
    const reg = createLayerRegistry();
    const l = fakeLayer({ withMesh: true, threshold: 7 });
    const rc = ray();
    let seen = -1;
    (l.pick as ReturnType<typeof vi.fn>).mockImplementation(() => {
      seen = rc.params.Points!.threshold!;
      return info;
    });
    reg.add('a', l, new THREE.Scene());
    rc.params.Points!.threshold = 3;
    reg.pick(rc);
    expect(seen).toBe(7);
    expect(rc.params.Points!.threshold).toBe(3);
  });

  it('dispose викликає layer.dispose і знімає групи зі сцени', () => {
    const reg = createLayerRegistry();
    const scene = new THREE.Scene();
    const l = fakeLayer();
    reg.add('a', l, scene);
    reg.dispose(scene);
    expect(l.dispose).toHaveBeenCalled();
    expect(scene.children).not.toContain(l.group);
  });
});
