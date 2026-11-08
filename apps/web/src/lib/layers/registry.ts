import type * as THREE from 'three';
import type { GlobeLayer, HoverInfo, LayerRegistry } from './types';

export function createLayerRegistry(): LayerRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers = new Map<string, GlobeLayer<any>>();

  return {
    add(key, layer, scene) {
      layers.set(key, layer);
      scene.add(layer.group);
    },

    get<T>(key: string) {
      return layers.get(key) as GlobeLayer<T> | undefined;
    },

    groups() {
      const out: Record<string, THREE.Group> = {};
      layers.forEach((layer, key) => {
        out[key] = layer.group;
      });
      return out;
    },

    update(dt, now) {
      layers.forEach((layer) => {
        if (layer.group.visible) layer.update(dt, now);
      });
    },

    pick(raycaster): HoverInfo | null {
      const points = raycaster.params.Points;
      const prevThreshold = points?.threshold;
      try {
        for (const layer of Array.from(layers.values())) {
          if (!layer.group.visible || !layer.pick) continue;
          if (points && layer.pickThreshold !== undefined) {
            points.threshold = layer.pickThreshold;
          }
          const hit = raycaster.intersectObjects(layer.group.children, true)[0];
          if (!hit) continue;
          const info = layer.pick(hit);
          if (info) return info;
        }
        return null;
      } finally {
        // Повертаємо попередній поріг
        if (points && prevThreshold !== undefined) points.threshold = prevThreshold;
      }
    },

    dispose(scene) {
      layers.forEach((layer) => {
        scene.remove(layer.group);
        layer.dispose();
      });
      layers.clear();
    },
  };
}
