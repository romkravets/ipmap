import type { SatOmm, SatelliteGroup } from '@ipmap/types';

// Запити основного потоку до воркера SGP4
export type SatWorkerRequest =
  | { type: 'load'; group: SatelliteGroup; gen: number; omms: SatOmm[] }
  | { type: 'unload'; group: SatelliteGroup }
  | { type: 'tick'; group: SatelliteGroup; gen: number; ms: number };

// Відповідь воркера: positions — трійки (lat, lng, altKm) на кожен супутник
export type SatWorkerResponse = {
  type: 'positions';
  group: SatelliteGroup;
  gen: number;
  ms: number;
  positions: Float32Array;
};

// Мінімальний інтерфейс воркера (дозволяє підміну у тестах)
export interface SatWorkerPort {
  postMessage(msg: SatWorkerRequest): void;
  onmessage: ((e: { data: SatWorkerResponse }) => void) | null;
  terminate(): void;
}
