import type { SessionInfo, SessionRegion } from '@sessionmap/types'
import { SESSION_TIMES } from './constants'

export function getSessionInfo(timeOffsetHours = 0): SessionInfo {
  const now = new Date(Date.now() + timeOffsetHours * 3_600_000)
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600

  const active: SessionRegion[] = (Object.entries(SESSION_TIMES) as [SessionRegion, { start: number; end: number }][])
    .filter(([, s]) => utcH >= s.start && utcH < s.end)
    .map(([k]) => k)

  const events = (Object.entries(SESSION_TIMES) as [SessionRegion, { start: number; end: number }][]).map(([key, s]) => {
    const isActive = active.includes(key)
    let diff = isActive ? s.end - utcH : s.start - utcH
    if (diff < 0) diff += 24
    return { type: (isActive ? 'close' : 'open') as 'open' | 'close', session: key, hours: diff }
  })
  events.sort((a, b) => a.hours - b.hours)

  let volatility: SessionInfo['volatility'] = 'low'
  if (active.length === 2) volatility = 'high'
  else if (active.length === 1) volatility = 'medium'

  return { active, nextEvent: events[0] ?? null, volatility, utcH }
}

export function formatCountdown(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export function getSunLatLng(date: Date): { lat: number; lng: number } {
  const doy = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const declination = -23.45 * Math.cos(((doy + 10) / 365) * 2 * Math.PI)
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const sunLng = (12 - utcH) * 15
  return { lat: declination, lng: sunLng }
}

export function fgLabel(n: number): string {
  if (n < 25) return 'Extreme Fear'
  if (n < 45) return 'Fear'
  if (n < 55) return 'Neutral'
  if (n < 75) return 'Greed'
  return 'Extreme Greed'
}
