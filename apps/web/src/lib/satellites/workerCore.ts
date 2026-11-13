import type { SatelliteGroup } from '@ipmap/types';
import { createPropagator, type Propagator } from './propagator';
import type { SatWorkerRequest, SatWorkerResponse } from './protocol';

// Чиста логіка воркера (без залежності від глобалів воркера — тестується напряму)
export function createWorkerCore(
  post: (res: SatWorkerResponse, transfer: Transferable[]) => void,
): (msg: SatWorkerRequest) => void {
  const groups = new Map<SatelliteGroup, { propagator: Propagator; gen: number }>();

  return (msg) => {
    switch (msg.type) {
      case 'load': {
        const propagator = createPropagator();
        propagator.load(msg.omms);
        groups.set(msg.group, { propagator, gen: msg.gen });
        break;
      }
      case 'unload':
        groups.delete(msg.group);
        break;
      case 'tick': {
        const state = groups.get(msg.group);
        // Невідома група або застарілий gen — тік відкидається
        if (!state || state.gen !== msg.gen) return;
        const positions = state.propagator.positionsAt(msg.ms);
        post(
          { type: 'positions', group: msg.group, gen: state.gen, ms: msg.ms, positions },
          [positions.buffer],
        );
        break;
      }
    }
  };
}
