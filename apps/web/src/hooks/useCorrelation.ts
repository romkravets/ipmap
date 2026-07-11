"use client";

import { useState, useEffect } from "react";
import { pearson, logReturns } from "@/lib/correlation";

/**
 * Fetches 30-day daily closes for BTC-USD and QQQ from /api/corr,
 * converts to log-returns, and computes Pearson r.
 * Refreshes every 30 min (server cache is also 30 min).
 */
export function useCorrelation(): number | null {
  const [corr, setCorr] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function compute() {
      try {
        const res = await fetch("/api/corr", {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { btc: number[]; qqq: number[] };
        if (cancelled) return;
        const r = pearson(logReturns(data.btc), logReturns(data.qqq));
        setCorr(r);
      } catch {
        // Silently ignore — correlation is informational, not critical
      }
    }

    compute();
    const id = setInterval(compute, 30 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return corr;
}
