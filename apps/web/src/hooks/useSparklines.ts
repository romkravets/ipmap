'use client'

import { useEffect, useRef, useState } from 'react'
import type { PriceSnapshot } from '@sessionmap/types'

const MAX_POINTS = 100

export function useSparklines(prices: PriceSnapshot): Map<string, number[]> {
  const historyRef = useRef<Map<string, number[]>>(new Map())
  const [, setTick] = useState(0)

  // Accumulate on every prices change (no re-render here)
  useEffect(() => {
    for (const [sym, entry] of Object.entries(prices)) {
      const arr = historyRef.current.get(sym) ?? []
      arr.push(entry.price)
      if (arr.length > MAX_POINTS) arr.shift()
      historyRef.current.set(sym, arr)
    }
  }, [prices])

  // Trigger re-render every 5s so sparklines visually update
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  return historyRef.current
}
