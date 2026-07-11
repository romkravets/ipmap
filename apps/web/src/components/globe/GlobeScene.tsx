'use client'

import { useRef, memo } from 'react'
import { useGlobe } from '@/hooks/useGlobe'
import type { GlobeMode, TweakValues, CountryAlloc } from '@ipmap/types'

interface GlobeSceneProps {
  mode: GlobeMode
  tweaks: TweakValues
  countries?: CountryAlloc[]
  onCountryClick?: (cc: string) => void
}

export const GlobeScene = memo(function GlobeScene({ mode, tweaks, countries, onCountryClick }: GlobeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGlobe(canvasRef, { mode, tweaks, countries, onCountryClick })

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
      }}
    />
  )
})
