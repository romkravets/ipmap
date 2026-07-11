import { useState, useEffect } from 'react'
import type { CountryAlloc, IpBlock } from '@ipmap/types'

interface RawIpData {
  byCountry: Record<string, number>
  blocksByCountry: Record<string, IpBlock[]>
}

interface RawCentroids {
  [cc: string]: { lat: number; lng: number; name: string }
}

export function parseIpData(ipv4: RawIpData, centroids: RawCentroids): CountryAlloc[] {
  const countries: CountryAlloc[] = []
  for (const [cc, ipCount] of Object.entries(ipv4.byCountry)) {
    const c = centroids[cc]
    if (!c) continue
    countries.push({ cc, name: c.name, ipCount, lat: c.lat, lng: c.lng })
  }
  return countries
}

export interface IpDataResult {
  countries: CountryAlloc[]
  blocksByCountry: Record<string, IpBlock[]>
  isLoading: boolean
  error: string | null
}

export function useIpData(): IpDataResult {
  const [result, setResult] = useState<IpDataResult>({
    countries: [],
    blocksByCountry: {},
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    Promise.all([
      fetch('/data/ipv4-by-country.json').then(r => {
        if (!r.ok) throw new Error(`ipv4 data: ${r.status}`)
        return r.json() as Promise<RawIpData>
      }),
      fetch('/data/centroids.json').then(r => {
        if (!r.ok) throw new Error(`centroids: ${r.status}`)
        return r.json() as Promise<RawCentroids>
      }),
    ])
      .then(([ipv4, centroids]) => {
        setResult({
          countries: parseIpData(ipv4, centroids),
          blocksByCountry: ipv4.blocksByCountry,
          isLoading: false,
          error: null,
        })
      })
      .catch((err: Error) => {
        setResult(prev => ({ ...prev, isLoading: false, error: err.message }))
      })
  }, [])

  return result
}
