import { describe, it, expect } from 'vitest'
import {
  STOCK_MARKETS,
  EXCHANGES,
  SESSION_TIMES,
  SESSION_COLORS_CSS,
  SESSION_COLORS_HEX,
  SESSION_LABELS,
  TWEAK_DEFAULTS,
  isStockMarketOpen,
  type StockMarket,
} from '../constants'

describe('SESSION_TIMES', () => {
  it('has entries for asia, europe, and americas', () => {
    expect(SESSION_TIMES).toHaveProperty('asia')
    expect(SESSION_TIMES).toHaveProperty('europe')
    expect(SESSION_TIMES).toHaveProperty('americas')
  })

  it('each session has start and end hours', () => {
    for (const key of ['asia', 'europe', 'americas']) {
      expect(SESSION_TIMES[key].start).toBeTypeOf('number')
      expect(SESSION_TIMES[key].end).toBeTypeOf('number')
      expect(SESSION_TIMES[key].end).toBeGreaterThan(SESSION_TIMES[key].start)
    }
  })

  it('has correct session windows', () => {
    expect(SESSION_TIMES.asia).toEqual({ start: 0, end: 9 })
    expect(SESSION_TIMES.europe).toEqual({ start: 7, end: 16 })
    expect(SESSION_TIMES.americas).toEqual({ start: 13, end: 22 })
  })
})

describe('SESSION_COLORS_CSS', () => {
  it('has CSS variable strings for each session', () => {
    expect(SESSION_COLORS_CSS.asia).toMatch(/var\(--/)
    expect(SESSION_COLORS_CSS.europe).toMatch(/var\(--/)
    expect(SESSION_COLORS_CSS.americas).toMatch(/var\(--/)
  })
})

describe('SESSION_COLORS_HEX', () => {
  it('has hex color strings for each session', () => {
    for (const key of ['asia', 'europe', 'americas']) {
      expect(SESSION_COLORS_HEX[key]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('SESSION_LABELS', () => {
  it('has human-readable labels', () => {
    expect(SESSION_LABELS.asia).toBe('Asia')
    expect(SESSION_LABELS.europe).toBe('Europe')
    expect(SESSION_LABELS.americas).toBe('Americas')
  })
})

describe('TWEAK_DEFAULTS', () => {
  it('has all required tweak keys', () => {
    expect(TWEAK_DEFAULTS).toHaveProperty('rotationSpeed')
    expect(TWEAK_DEFAULTS).toHaveProperty('showTerminator')
    expect(TWEAK_DEFAULTS).toHaveProperty('showSunMarker')
    expect(TWEAK_DEFAULTS).toHaveProperty('markerPulse')
    expect(TWEAK_DEFAULTS).toHaveProperty('timeOffset')
  })

  it('has sensible default values', () => {
    expect(TWEAK_DEFAULTS.rotationSpeed).toBeTypeOf('number')
    expect(TWEAK_DEFAULTS.showTerminator).toBeTypeOf('boolean')
    expect(TWEAK_DEFAULTS.showSunMarker).toBeTypeOf('boolean')
    expect(TWEAK_DEFAULTS.markerPulse).toBeTypeOf('boolean')
    expect(TWEAK_DEFAULTS.timeOffset).toBe(0)
  })
})

describe('STOCK_MARKETS', () => {
  it('is a non-empty array', () => {
    expect(STOCK_MARKETS.length).toBeGreaterThan(0)
  })

  it('each market has required fields', () => {
    for (const market of STOCK_MARKETS) {
      expect(market.id).toBeTypeOf('string')
      expect(market.name).toBeTypeOf('string')
      expect(market.tz).toBeTypeOf('string')
      expect(market.openLocal).toBeTypeOf('number')
      expect(market.closeLocal).toBeTypeOf('number')
      expect(market.closeLocal).toBeGreaterThan(market.openLocal)
    }
  })

  it('includes major exchanges', () => {
    const ids = STOCK_MARKETS.map((m) => m.id)
    expect(ids).toContain('nyse')
    expect(ids).toContain('nasdaq')
    expect(ids).toContain('lse')
  })
})

describe('EXCHANGES', () => {
  it('is a non-empty array', () => {
    expect(EXCHANGES.length).toBeGreaterThan(0)
  })

  it('each exchange has required fields', () => {
    for (const ex of EXCHANGES) {
      expect(ex.id).toBeTypeOf('string')
      expect(ex.name).toBeTypeOf('string')
      expect(ex.vol).toBeTypeOf('number')
      expect(['asia', 'europe', 'americas']).toContain(ex.region)
    }
  })

  it('includes well-known exchanges', () => {
    const ids = EXCHANGES.map((e) => e.id)
    expect(ids).toContain('binance')
    expect(ids).toContain('coinbase')
    expect(ids).toContain('kraken')
  })
})

describe('isStockMarketOpen', () => {
  const nyse: StockMarket = {
    id: 'nyse',
    name: 'NYSE',
    city: 'New York',
    lat: 40.707,
    lng: -74.011,
    tz: 'America/New_York',
    openLocal: 9.5,
    closeLocal: 16.0,
    color: '#60a5fa',
  }

  it('returns false on Saturday', () => {
    // 2024-01-06 is a Saturday
    const sat = new Date('2024-01-06T15:00:00Z') // 10:00 EST
    expect(isStockMarketOpen(nyse, sat)).toBe(false)
  })

  it('returns false on Sunday', () => {
    // 2024-01-07 is a Sunday
    const sun = new Date('2024-01-07T15:00:00Z')
    expect(isStockMarketOpen(nyse, sun)).toBe(false)
  })

  it('returns true during market hours on a weekday', () => {
    // 2024-01-08 Monday, 15:00 UTC = 10:00 EST (market is open 9:30–16:00)
    const open = new Date('2024-01-08T15:00:00Z')
    expect(isStockMarketOpen(nyse, open)).toBe(true)
  })

  it('returns false before market open on a weekday', () => {
    // 2024-01-08 Monday, 13:00 UTC = 08:00 EST (before 9:30)
    const beforeOpen = new Date('2024-01-08T13:00:00Z')
    expect(isStockMarketOpen(nyse, beforeOpen)).toBe(false)
  })

  it('returns false after market close on a weekday', () => {
    // 2024-01-08 Monday, 22:00 UTC = 17:00 EST (after 16:00)
    const afterClose = new Date('2024-01-08T22:00:00Z')
    expect(isStockMarketOpen(nyse, afterClose)).toBe(false)
  })

  it('handles TSE lunch break', () => {
    const tse: StockMarket = {
      id: 'tse',
      name: 'TSE',
      city: 'Tokyo',
      lat: 35.681,
      lng: 139.767,
      tz: 'Asia/Tokyo',
      openLocal: 9.0,
      closeLocal: 15.5,
      lunchStart: 11.5,
      lunchEnd: 12.5,
      color: '#f87171',
    }
    // 2024-01-08 Monday, 02:45 UTC = 11:45 JST (inside lunch 11:30–12:30)
    const lunch = new Date('2024-01-08T02:45:00Z')
    expect(isStockMarketOpen(tse, lunch)).toBe(false)

    // 2024-01-08 Monday, 01:00 UTC = 10:00 JST (before lunch)
    const beforeLunch = new Date('2024-01-08T01:00:00Z')
    expect(isStockMarketOpen(tse, beforeLunch)).toBe(true)
  })
})
