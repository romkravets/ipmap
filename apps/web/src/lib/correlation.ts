/**
 * Pure Pearson correlation and log-returns helpers.
 * No external dependencies — runs entirely on the client.
 */

/** Compute daily log returns from a price series. */
export function logReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      r.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return r;
}

/** Pearson correlation coefficient. Returns null when insufficient data. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;

  const x = xs.slice(0, n);
  const y = ys.slice(0, n);

  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;

  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const xd = x[i] - mx;
    const yd = y[i] - my;
    num += xd * yd;
    dx2 += xd * xd;
    dy2 += yd * yd;
  }

  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}
