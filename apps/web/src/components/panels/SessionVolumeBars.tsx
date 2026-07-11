'use client'

import { memo } from 'react'
import { EXCHANGES, SESSION_COLORS_CSS, SESSION_LABELS } from '@/lib/constants'
import type { SessionRegion } from '@sessionmap/types'

const REGIONS: SessionRegion[] = ['asia', 'europe', 'americas']

function computeVolumes(): Record<SessionRegion, number> {
  const totals: Record<SessionRegion, number> = { asia: 0, europe: 0, americas: 0 }
  for (const ex of EXCHANGES) {
    totals[ex.region] += ex.vol
  }
  return totals
}

// Precompute once (static data)
const VOLUMES = computeVolumes()
const MAX_VOL = Math.max(...Object.values(VOLUMES))

interface SessionVolumeBarsProps {
  compact?: boolean
}

export const SessionVolumeBars = memo(function SessionVolumeBars({ compact = false }: SessionVolumeBarsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '3px' : '5px' }}>
      {!compact && (
        <div style={{
          fontSize: '9px', color: 'var(--fg-muted)',
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: '2px',
        }}>
          Exchange Volume by Region
        </div>
      )}
      {REGIONS.map(region => {
        const vol = VOLUMES[region]
        const pct = (vol / MAX_VOL) * 100

        return (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-mono, monospace)',
              color: SESSION_COLORS_CSS[region],
              width: compact ? '50px' : '70px', flexShrink: 0,
              letterSpacing: '0.04em',
            }}>
              {SESSION_LABELS[region].toUpperCase()}
            </span>
            <div style={{
              flex: 1, height: compact ? '3px' : '4px',
              background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct.toFixed(1)}%`, height: '100%',
                background: SESSION_COLORS_CSS[region],
                borderRadius: '2px',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--fg-muted)', width: '36px', textAlign: 'right', flexShrink: 0,
            }}>
              ${vol.toFixed(0)}B
            </span>
          </div>
        )
      })}
    </div>
  )
})
