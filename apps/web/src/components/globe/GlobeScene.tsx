'use client'

import { useRef, memo } from 'react'
import { useGlobe } from '@/hooks/useGlobe'
import type { SatelliteLayerData } from '@/lib/layers/satellites'
import type { GlobeMode, TweakValues, CountryAlloc, IpBlock, SubmarineCable, DataCenter, IxPoint, InfraHoverInfo } from '@ipmap/types'

interface GlobeSceneProps {
  mode: GlobeMode
  tweaks: TweakValues
  countries?: CountryAlloc[]
  selectedCountry?: string | null
  countryData?: CountryAlloc | null
  countryBlocks?: IpBlock[]
  selectedBlock?: IpBlock | null
  onCountryClick?: (cc: string) => void
  onBlockClick?: (block: IpBlock) => void
  onBlockHover?: (block: IpBlock | null, x: number, y: number) => void
  onInfraHover?: (info: InfraHoverInfo | null, x: number, y: number) => void
  cables?: SubmarineCable[]
  dataCenters?: DataCenter[]
  ixps?: IxPoint[]
  satellites?: SatelliteLayerData
}

export const GlobeScene = memo(function GlobeScene({
  mode,
  tweaks,
  countries,
  selectedCountry,
  countryData,
  countryBlocks,
  selectedBlock,
  onCountryClick,
  onBlockClick,
  onBlockHover,
  onInfraHover,
  cables,
  dataCenters,
  ixps,
  satellites,
}: GlobeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGlobe(canvasRef, { mode, tweaks, countries, selectedCountry, countryData, countryBlocks, selectedBlock, onCountryClick, onBlockClick, onBlockHover, onInfraHover, cables, dataCenters, ixps, satellites })

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
