'use client'

import { memo } from 'react'
import type { WhaleEvent } from '@sessionmap/types'

const TYPE_COLORS: Record<WhaleEvent['type'], string> = {
  transfer: '#FBBF24',
  deposit:  '#7DD3FC',
  withdraw: '#F472B6',
  dex:      '#34D399',
}

interface WhaleTickerProps {
  events: WhaleEvent[]
}

export const WhaleTicker = memo(function WhaleTicker({ events }: WhaleTickerProps) {
  if (!events.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignSelf: 'flex-start', maxWidth: '340px' }}>
      {events.slice(0, 3).map(w => {
        const col = TYPE_COLORS[w.type]
        return (
          <div key={w.id} style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${col}22`,
            borderRadius: '5px',
            padding: '4px 10px',
          }}>
            <span style={{
              fontSize: '9px',
              color: col,
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              minWidth: '52px',
            }}>
              {w.type}
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--fg)',
              fontWeight: 500,
            }}>
              {w.amount.toLocaleString()} BTC
            </span>
            <span style={{
              fontSize: '9px',
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono, monospace)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {w.from} → {w.to}
            </span>
            {w.simulated && (
              <span style={{
                fontSize: '7px',
                padding: '1px 4px',
                background: 'rgba(251,191,36,0.15)',
                border: '1px solid rgba(251,191,36,0.4)',
                borderRadius: '2px',
                color: '#fbbf24',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                marginLeft: '4px',
                verticalAlign: 'middle',
              }}>SIM</span>
            )}
          </div>
        )
      })}
    </div>
  )
})
