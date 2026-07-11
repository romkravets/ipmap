'use client'

import { useRef, memo } from 'react'
import { useGlobe } from '@/hooks/useGlobe'
import type { GlobeMode, TweakValues } from '@sessionmap/types'

interface GlobeSceneProps {
  mode: GlobeMode
  tweaks: TweakValues
}

export const GlobeScene = memo(function GlobeScene({ mode, tweaks }: GlobeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGlobe(canvasRef, { mode, tweaks })

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
