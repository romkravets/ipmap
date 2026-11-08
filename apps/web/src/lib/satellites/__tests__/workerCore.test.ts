import { describe, it, expect, vi } from 'vitest';
import type { SatOmm } from '@ipmap/types';
import { compressOmm } from '../omm';
import { createWorkerCore } from '../workerCore';
import fixture from '../__fixtures__/iss-omm.json';

const iss: SatOmm = compressOmm(fixture)[0];
const epochMs = Date.parse(iss.EPOCH);

describe('createWorkerCore', () => {
  it('load + tick відправляє positions з transfer-буфером', () => {
    const post = vi.fn();
    const core = createWorkerCore(post);
    core({ type: 'load', group: 'stations', gen: 1, omms: [iss] });
    core({ type: 'tick', group: 'stations', gen: 1, ms: epochMs });
    expect(post).toHaveBeenCalledTimes(1);
    const [res, transfer] = post.mock.calls[0];
    expect(res).toMatchObject({ type: 'positions', group: 'stations', gen: 1, ms: epochMs });
    expect(res.positions).toHaveLength(3);
    expect(transfer).toContain(res.positions.buffer);
  });

  it('tick невідомої групи мовчить і не кидає', () => {
    const post = vi.fn();
    const core = createWorkerCore(post);
    expect(() => core({ type: 'tick', group: 'starlink', gen: 1, ms: epochMs })).not.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it('після unload tick нічого не відправляє', () => {
    const post = vi.fn();
    const core = createWorkerCore(post);
    core({ type: 'load', group: 'stations', gen: 1, omms: [iss] });
    core({ type: 'unload', group: 'stations' });
    core({ type: 'tick', group: 'stations', gen: 1, ms: epochMs });
    expect(post).not.toHaveBeenCalled();
  });

  it('групи не змішуються', () => {
    const post = vi.fn();
    const core = createWorkerCore(post);
    core({ type: 'load', group: 'stations', gen: 1, omms: [iss] });
    core({ type: 'load', group: 'starlink', gen: 4, omms: [iss, iss] });
    core({ type: 'tick', group: 'starlink', gen: 4, ms: epochMs });
    const res = post.mock.calls[0][0];
    expect(res.group).toBe('starlink');
    expect(res.positions).toHaveLength(6);
  });

  it('tick із застарілим gen відкидається', () => {
    const post = vi.fn();
    const core = createWorkerCore(post);
    core({ type: 'load', group: 'stations', gen: 2, omms: [iss] });
    core({ type: 'tick', group: 'stations', gen: 1, ms: epochMs });
    expect(post).not.toHaveBeenCalled();
  });
});
