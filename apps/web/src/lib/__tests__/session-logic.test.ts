import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSessionInfo, formatCountdown, getSunLatLng, fgLabel } from '../session-logic'

describe('formatCountdown', () => {
  it('returns only minutes when hours is 0', () => {
    expect(formatCountdown(0.5)).toBe('30m')
  })

  it('returns hours and minutes when >= 1 hour', () => {
    expect(formatCountdown(1.5)).toBe('1h 30m')
  })

  it('returns 0m for zero', () => {
    expect(formatCountdown(0)).toBe('0m')
  })

  it('handles whole hours with 0 minutes', () => {
    expect(formatCountdown(2)).toBe('2h 0m')
  })

  it('handles fractional minutes correctly', () => {
    expect(formatCountdown(1.25)).toBe('1h 15m')
  })
})

describe('fgLabel', () => {
  it('returns Extreme Fear for values below 25', () => {
    expect(fgLabel(0)).toBe('Extreme Fear')
    expect(fgLabel(10)).toBe('Extreme Fear')
    expect(fgLabel(24)).toBe('Extreme Fear')
  })

  it('returns Fear for values 25-44', () => {
    expect(fgLabel(25)).toBe('Fear')
    expect(fgLabel(35)).toBe('Fear')
    expect(fgLabel(44)).toBe('Fear')
  })

  it('returns Neutral for values 45-54', () => {
    expect(fgLabel(45)).toBe('Neutral')
    expect(fgLabel(50)).toBe('Neutral')
    expect(fgLabel(54)).toBe('Neutral')
  })

  it('returns Greed for values 55-74', () => {
    expect(fgLabel(55)).toBe('Greed')
    expect(fgLabel(65)).toBe('Greed')
    expect(fgLabel(74)).toBe('Greed')
  })

  it('returns Extreme Greed for values 75+', () => {
    expect(fgLabel(75)).toBe('Extreme Greed')
    expect(fgLabel(100)).toBe('Extreme Greed')
  })
})

describe('getSunLatLng', () => {
  it('returns lat and lng properties', () => {
    const result = getSunLatLng(new Date('2024-06-21T12:00:00Z'))
    expect(result).toHaveProperty('lat')
    expect(result).toHaveProperty('lng')
  })

  it('returns lat within ±23.45 degrees (solar declination bounds)', () => {
    const result = getSunLatLng(new Date('2024-06-21T12:00:00Z'))
    expect(result.lat).toBeGreaterThanOrEqual(-23.45)
    expect(result.lat).toBeLessThanOrEqual(23.45)
  })

  it('sun is at lng 0 at noon UTC', () => {
    const noon = new Date('2024-01-01T12:00:00Z')
    const result = getSunLatLng(noon)
    // At 12:00 UTC, sunLng = (12 - 12) * 15 = 0
    expect(result.lng).toBeCloseTo(0, 5)
  })

  it('sun longitude shifts with UTC time', () => {
    const sixAm = new Date('2024-01-01T06:00:00Z')
    const result = getSunLatLng(sixAm)
    // At 06:00 UTC, sunLng = (12 - 6) * 15 = 90
    expect(result.lng).toBeCloseTo(90, 5)
  })
})

describe('getSessionInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns SessionInfo with expected shape', () => {
    vi.setSystemTime(new Date('2024-01-01T08:00:00Z')) // UTC 8 → asia+europe overlap
    const info = getSessionInfo()
    expect(info).toHaveProperty('active')
    expect(info).toHaveProperty('nextEvent')
    expect(info).toHaveProperty('volatility')
    expect(info).toHaveProperty('utcH')
  })

  it('detects Asia session at UTC 4:00', () => {
    vi.setSystemTime(new Date('2024-01-01T04:00:00Z'))
    const info = getSessionInfo()
    expect(info.active).toContain('asia')
    expect(info.active).not.toContain('europe')
    expect(info.active).not.toContain('americas')
    expect(info.volatility).toBe('medium')
  })

  it('detects Europe session at UTC 11:00', () => {
    vi.setSystemTime(new Date('2024-01-01T11:00:00Z'))
    const info = getSessionInfo()
    expect(info.active).toContain('europe')
    expect(info.active).not.toContain('asia')
    expect(info.active).not.toContain('americas')
    expect(info.volatility).toBe('medium')
  })

  it('detects Americas session at UTC 17:00', () => {
    vi.setSystemTime(new Date('2024-01-01T17:00:00Z'))
    const info = getSessionInfo()
    expect(info.active).toContain('americas')
    expect(info.active).not.toContain('asia')
    expect(info.volatility).toBe('medium')
  })

  it('detects high volatility at Europe+Americas overlap (UTC 14:00)', () => {
    vi.setSystemTime(new Date('2024-01-01T14:00:00Z'))
    const info = getSessionInfo()
    expect(info.active).toContain('europe')
    expect(info.active).toContain('americas')
    expect(info.volatility).toBe('high')
  })

  it('returns low volatility when no session is active (UTC 23:00)', () => {
    vi.setSystemTime(new Date('2024-01-01T23:00:00Z'))
    const info = getSessionInfo()
    expect(info.active).toHaveLength(0)
    expect(info.volatility).toBe('low')
  })

  it('nextEvent is the soonest upcoming event', () => {
    vi.setSystemTime(new Date('2024-01-01T04:00:00Z'))
    const info = getSessionInfo()
    expect(info.nextEvent).not.toBeNull()
    expect(info.nextEvent!.hours).toBeGreaterThan(0)
  })

  it('applies timeOffsetHours correctly', () => {
    // UTC 23:00 normally has no session; +1h offset puts it at 00:00 → asia opens
    vi.setSystemTime(new Date('2024-01-01T23:00:00Z'))
    const infoNoOffset = getSessionInfo(0)
    const infoWithOffset = getSessionInfo(1)
    expect(infoNoOffset.active).toHaveLength(0)
    expect(infoWithOffset.active).toContain('asia')
  })
})
