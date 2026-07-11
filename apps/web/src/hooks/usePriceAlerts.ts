'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PriceSnapshot } from '@sessionmap/types'

export interface PriceAlert {
  id: string
  symbol: string
  direction: 'above' | 'below'
  threshold: number
  createdAt: number
}

const STORAGE_KEY = 'sessionmap_price_alerts'

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PriceAlert[]) : []
  } catch {
    return []
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
  } catch {
    // ignore storage errors
  }
}

export function usePriceAlerts(prices: PriceSnapshot) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const firedRef = useRef<Set<string>>(new Set())

  // Load from localStorage on mount
  useEffect(() => {
    setAlerts(loadAlerts())
  }, [])

  // Check alerts on every price update
  useEffect(() => {
    for (const alert of alerts) {
      const entry = prices[alert.symbol]
      if (!entry) continue
      const key = `${alert.id}-${alert.threshold}`
      const triggered =
        alert.direction === 'above'
          ? entry.price >= alert.threshold
          : entry.price <= alert.threshold

      if (triggered && !firedRef.current.has(key)) {
        firedRef.current.add(key)
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(`SessionMap Alert: ${alert.symbol}`, {
              body: `${alert.symbol} is ${alert.direction} $${alert.threshold.toLocaleString()}`,
              icon: '/favicon.ico',
            })
          }
        }
      } else if (!triggered) {
        // Reset so alert can fire again if price crosses back
        firedRef.current.delete(key)
      }
    }
  }, [prices, alerts])

  const addAlert = useCallback((symbol: string, direction: 'above' | 'below', threshold: number) => {
    setAlerts(prev => {
      const next = [...prev, { id: `${Date.now()}`, symbol, direction, threshold, createdAt: Date.now() }]
      saveAlerts(next)
      return next
    })
  }, [])

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id)
      saveAlerts(next)
      return next
    })
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      await Notification.requestPermission()
    }
  }, [])

  return { alerts, addAlert, removeAlert, requestNotificationPermission }
}
