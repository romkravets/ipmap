import { NextResponse } from "next/server";
import { yahooFetch } from "@/lib/yahoo-finance";

const SYMBOLS = ["NVDA", "MSFT", "GOOGL", "META", "SPY", "QQQ", "^DJI"];

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  marketState: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  marketState: string;
}

export const runtime = "nodejs";

// Module-level cache
let cachedQuotes: StockQuote[] | null = null
let cachedAt = 0

export async function GET() {
  const now = Date.now()
  const anyLivePrev = cachedQuotes?.some((q) => q.marketState === "REGULAR") ?? false
  const ttl = anyLivePrev ? 60_000 : 900_000

  if (cachedQuotes && now - cachedAt < ttl) {
    return NextResponse.json(cachedQuotes, {
      headers: { "Cache-Control": `public, s-maxage=${Math.round(ttl / 1000)}, stale-while-revalidate=60` },
    })
  }

  const symsParam = SYMBOLS.join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symsParam)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,marketState`;

  try {
    const res = await yahooFetch(url);

    if (!res.ok) {
      if (cachedQuotes) return NextResponse.json(cachedQuotes)
      return NextResponse.json({ error: `Yahoo Finance ${res.status}` }, { status: 502 });
    }

    const data = (await res.json()) as { quoteResponse: { result: YahooQuote[] } };
    const result = data.quoteResponse?.result ?? [];
    const quotes: StockQuote[] = result.map((q) => ({
      symbol: q.symbol.replace("^", ""),
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      marketState: q.marketState,
    }));

    cachedQuotes = quotes
    cachedAt = now
    const anyLive = quotes.some((q) => q.marketState === "REGULAR");
    const cacheSec = anyLive ? 60 : 900;

    return NextResponse.json(quotes, {
      headers: { "Cache-Control": `public, s-maxage=${cacheSec}, stale-while-revalidate=30` },
    });
  } catch (err) {
    if (cachedQuotes) return NextResponse.json(cachedQuotes)
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
