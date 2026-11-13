import type * as THREE from 'three';
import type { InfraHoverInfo } from '@ipmap/types';

// Інформація про об'єкт під курсором (розширюється новими видами шарів)
export type HoverInfo = InfraHoverInfo;

// Контракт шару глобуса
export interface GlobeLayer<TData> {
  group: THREE.Group;
  // Поріг для Points-raycast на час pick цього шару
  pickThreshold?: number;
  setData(data: TData): void;
  update(dt: number, now: Date): void;
  pick?(hit: THREE.Intersection): HoverInfo | null;
  dispose(): void;
}

export interface LayerRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add(key: string, layer: GlobeLayer<any>, scene: THREE.Scene): void;
  get<T>(key: string): GlobeLayer<T> | undefined;
  groups(): Record<string, THREE.Group>;
  update(dt: number, now: Date): void;
  pick(raycaster: THREE.Raycaster): HoverInfo | null;
  dispose(scene: THREE.Scene): void;
}
