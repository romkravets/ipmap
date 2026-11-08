import { createWorkerCore } from './workerCore';
import type { SatWorkerRequest, SatWorkerResponse } from './protocol';

// Мінімальна типізація контексту воркера (tsconfig без lib "webworker")
const ctx = self as unknown as {
  onmessage: ((e: { data: SatWorkerRequest }) => void) | null;
  postMessage(msg: SatWorkerResponse, transfer: Transferable[]): void;
};

const core = createWorkerCore((res, transfer) => ctx.postMessage(res, transfer));
ctx.onmessage = (e) => core(e.data);
