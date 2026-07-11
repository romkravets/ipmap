'use client'

import { memo } from 'react'
import type { GlobeMode } from '@sessionmap/types'

const MODE_META: Record<GlobeMode, { label: string; icon: string; tip: string }> = {
  auto:    { label: 'Auto',       icon: '↺', tip: 'Slow auto-rotation' },
  free:    { label: 'Free',       icon: '✦', tip: 'Drag to explore' },
  follow:  { label: 'Follow Sun', icon: '☀', tip: 'Camera tracks dayside' },
  heatmap: { label: 'Heatmap',    icon: '🔥', tip: 'Volume heatmap overlay' },
}

interface GlobeModeBarProps {
  mode: GlobeMode
  onChange: (mode: GlobeMode) => void
}

export const GlobeModeBar = memo(function GlobeModeBar({ mode, onChange }: GlobeModeBarProps) {
  return (
    <div style={{ display: 'flex', gap: '4px', pointerEvents: 'all' }}>
      {(Object.entries(MODE_META) as [GlobeMode, (typeof MODE_META)[GlobeMode]][]).map(([key, meta]) => {
        const active = mode === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={meta.tip}
            style={{
              background: active
                ? 'rgba(125,211,252,0.18)'
                : 'rgba(6,9,18,0.72)',
              border: `1px solid ${active ? 'rgba(125,211,252,0.7)' : 'rgba(255,255,255,0.22)'}`,
              borderRadius: '6px',
              padding: '5px 11px',
              cursor: 'pointer',
              color: active ? '#7dd3fc' : 'rgba(255,255,255,0.88)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              boxShadow: active
                ? '0 0 8px rgba(125,211,252,0.2), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ fontSize: '13px', lineHeight: 1 }}>{meta.icon}</span>
            <span className="mode-label">{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
})
