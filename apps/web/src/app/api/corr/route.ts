import { yahooFetch } from "@/lib/yahoo-finance";
import { NextResponse } from "next/server";

// Fetch daily closes from Yahoo Finance v8 chart API
async function fetchDailyCloses(symbol: string, days = 32): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${days}d`;

  const res = await yahooFetch(url);

  if (!res.ok) throw new Error(`Yahoo ${symbol} responded ${res.status}`);

  const data = (await res.json()) as {
    chart: {
      result?: Array<{
        indicators: { quote: Array<{ close: number[] | null[] }> };
      }>;
    };
  };

  const raw = data.chart.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  // Filter nulls (trading halt days) and keep real numbers
  return (raw as (number | null)[]).filter(
    (v): v is number => typeof v === "number" && isFinite(v),
  );
}

// 30 min server cache — correlation doesn't change minute-by-minute
export const revalidate = 1800;

export async function GET() {
  try {
    const [btc, qqq] = await Promise.all([
      fetchDailyCloses("BTC-USD", 32),
      fetchDailyCloses("QQQ", 32),
    ]);

    return NextResponse.json(
      { btc, qqq },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    // Yahoo Finance is unavailable or rate-limiting — return empty arrays so
    // the client shows "n/a" instead of a 502 error in the console.
    return NextResponse.json(
      { btc: [], qqq: [] },
      {
        headers: {
          // short cache so a subsequent request can try again in 5 min
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      },
    );
  }
}
