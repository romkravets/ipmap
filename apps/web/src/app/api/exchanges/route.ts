import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface CgExchange {
  id: string
  trade_volume_24h_btc: number
}

// Module-level cache — survives across requests within the same server instance
let cachedData: CgExchange[] | null = null
let cachedAt = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function GET() {
  const now = Date.now()

  // Serve from cache if fresh
  if (cachedData && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedData, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' },
    })
  }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/exchanges?per_page=50&page=1',
      {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/json' },
      },
    )

    if (res.status === 429) {
      // Rate-limited: return stale cache if available, else 429
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
        })
      }
      return NextResponse.json({ error: 'Rate limited, no cache yet' }, { status: 429 })
    }

    if (!res.ok) {
      if (cachedData) return NextResponse.json(cachedData)
      return NextResponse.json({ error: `CoinGecko ${res.status}` }, { status: 502 })
    }

    const data = (await res.json()) as CgExchange[]
    cachedData = data
    cachedAt = now

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' },
    })
  } catch (err) {
    if (cachedData) return NextResponse.json(cachedData)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
