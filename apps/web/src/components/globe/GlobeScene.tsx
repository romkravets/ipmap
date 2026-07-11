'use client'

import { useRef, memo } from 'react'
import { useGlobe } from '@/hooks/useGlobe'
import type { GlobeMode, TweakValues, CountryAlloc, IpBlock } from '@ipmap/types'

interface GlobeSceneProps {
  mode: GlobeMode
  tweaks: TweakValues
  countries?: CountryAlloc[]
  selectedCountry?: string | null
  countryData?: CountryAlloc | null
  countryBlocks?: IpBlock[]
  onCountryClick?: (cc: string) => void
  onBlockClick?: (block: IpBlock) => void
}

export const GlobeScene = memo(function GlobeScene({
  mode,
  tweaks,
  countries,
  selectedCountry,
  countryData,
  countryBlocks,
  onCountryClick,
  onBlockClick,
}: GlobeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGlobe(canvasRef, { mode, tweaks, countries, selectedCountry, countryData, countryBlocks, onCountryClick, onBlockClick })

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
