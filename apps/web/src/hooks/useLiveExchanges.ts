'use client'

import { useState, useEffect } from 'react'

// Maps CoinGecko exchange IDs to our internal IDs
const CGID_MAP: Record<string, string> = {
  binance:    'binance',
  okx:        'okx',
  bybit_spot: 'bybit',
  coinbase:   'coinbase',
  htx:        'htx',
  kucoin:     'kucoin',
  kraken:     'kraken',
  bitfinex:   'bitfinex',
  upbit:      'upbit',
  gate:       'gate',
  mexc:       'mexc',
  bitmex:     'bitmex',
  bithumb:    'bithumb',
  gemini:     'gemini',
  bitstamp:   'bitstamp',
}

interface CoinGeckoExchange {
  id: string
  trade_volume_24h_btc: number
}

export function useLiveExchanges(btcPrice: number): Map<string, number> {
  const [volMap, setVolMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!btcPrice) return

    async function fetchExchanges() {
      try {
        const res = await fetch(
          '/api/exchanges',
          { signal: AbortSignal.timeout(10000) }
        )
        if (!res.ok) return
        const data = (await res.json()) as CoinGeckoExchange[]
        const next = new Map<string, number>()
        for (const ex of data) {
          const localId = CGID_MAP[ex.id]
          if (localId) {
            // Convert BTC volume to USD (in billions)
            next.set(localId, (ex.trade_volume_24h_btc * btcPrice) / 1e9)
          }
        }
        setVolMap(next)
      } catch {
        // ignore — keep showing static data
      }
    }

    fetchExchanges()
    const id = setInterval(fetchExchanges, 5 * 60_000)
    return () => clearInterval(id)
  }, [btcPrice])

  return volMap
}
