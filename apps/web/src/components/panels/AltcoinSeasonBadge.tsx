'use client'

import { memo } from 'react'
import { computeAltcoinSeason } from '@/lib/altcoin-season'
import type { PriceSnapshot } from '@sessionmap/types'

interface AltcoinSeasonBadgeProps {
  prices: PriceSnapshot
  compact?: boolean
}

export const AltcoinSeasonBadge = memo(function AltcoinSeasonBadge({ prices, compact = false }: AltcoinSeasonBadgeProps) {
  const { score, label } = computeAltcoinSeason(prices)

  const color = score >= 75
    ? 'var(--session-americas)'
    : score >= 50
      ? 'var(--accent-warm)'
      : score >= 25
        ? 'var(--fg-muted)'
        : 'var(--accent)'

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Alt Season
        </span>
        <span style={{ fontSize: '10px', color, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
          {score}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Altcoin Season
        </span>
        <span style={{ fontSize: '11px', color, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
          {score} — {label}
        </span>
      </div>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-warm) 50%, var(--session-americas) 100%)',
          borderRadius: '2px',
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
})
