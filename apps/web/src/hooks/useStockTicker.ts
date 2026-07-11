"use client";

import { useState, useEffect } from "react";
import type { StockQuote } from "@/app/api/stocks/route";

export type { StockQuote };

export function useStockTicker(): { quotes: StockQuote[]; loading: boolean } {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stocks", {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as StockQuote[];
        if (!cancelled) setQuotes(data);
      } catch {
        // Yahoo Finance can fail (unofficial API) — silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Poll every 60 s; Yahoo's cache TTL is 60 s when market is live
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { quotes, loading };
}
