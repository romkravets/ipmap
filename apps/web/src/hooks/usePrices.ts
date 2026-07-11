'use client'

import { useEffect, useRef } from 'react'
import type { PriceSnapshot, WsStatus } from '@sessionmap/types'
import type { Dispatch } from 'react'
import type { Action } from '@/contexts/reducer'

export function usePrices(prices: PriceSnapshot, dispatch: Dispatch<Action>, wsStatus: WsStatus) {
  const pricesRef = useRef<PriceSnapshot>(prices)
  pricesRef.current = prices

  useEffect(() => {
    if (wsStatus === 'connected') return
    const id = setInterval(() => {
      const entries = Object.entries(pricesRef.current)
      if (!entries.length) return
      const next: PriceSnapshot = {}
      entries.forEach(([sym, entry]) => {
        next[sym] = {
          price: Math.max(0.0001, entry.price + (Math.random() - 0.495) * entry.price * 0.0003),
          change24h: entry.change24h + (Math.random() - 0.5) * 0.02,
        }
      })
      dispatch({ type: 'PRICES_UPDATE', payload: next })
    }, 800)
    return () => clearInterval(id)
  }, [wsStatus, dispatch])
}
