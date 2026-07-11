'use client'

import { memo } from 'react'

interface PriceSparklinesProps {
  symbol: string
  history: number[]
  width?: number
  height?: number
}

function buildPolyline(points: number[], w: number, h: number): string {
  if (points.length < 2) return ''
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / range) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export const PriceSparklines = memo(function PriceSparklines({
  symbol,
  history,
  width = 80,
  height = 24,
}: PriceSparklinesProps) {
  const points = buildPolyline(history, width, height)
  if (!points) return <span style={{ width, height, display: 'inline-block' }} />

  const last = history[history.length - 1]
  const first = history[0]
  const isUp = last >= first
  const lineColor = isUp ? 'var(--session-europe)' : 'var(--danger)'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', flexShrink: 0 }}
      aria-label={`${symbol} sparkline`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
})
