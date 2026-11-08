import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

describe('CSP', () => {
  it('дозволяє worker-src self blob: без нових connect-src хостів', async () => {
    const cfg = createRequire(import.meta.url)('../../next.config.js');
    const rules = await cfg.headers();
    const csp = rules
      .flatMap((r: { headers: { key: string; value: string }[] }) => r.headers)
      .find((h: { key: string }) => h.key === 'Content-Security-Policy').value as string;
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).not.toContain('celestrak');
  });
});
