import type { PriceSnapshot } from '@sessionmap/types'

const ALTCOINS = ['ETH', 'SOL', 'BNB', 'XRP'] as const

export interface AltcoinSeasonResult {
  score: number  // 0-100
  label: string
  outperformers: number
  total: number
}

export function computeAltcoinSeason(prices: PriceSnapshot): AltcoinSeasonResult {
  const btcChange = prices['BTC']?.change24h ?? 0
  let outperformers = 0
  let total = 0

  for (const sym of ALTCOINS) {
    const entry = prices[sym]
    if (!entry) continue
    total++
    if (entry.change24h > btcChange) outperformers++
  }

  const score = total === 0 ? 0 : Math.round((outperformers / total) * 100)

  let label: string
  if (score >= 75) label = 'Altcoin Season'
  else if (score >= 50) label = 'Mixed'
  else if (score >= 25) label = 'Leaning BTC'
  else label = 'Bitcoin Season'

  return { score, label, outperformers, total }
}
