import { describe, it, expect } from 'vitest'
import { reducer, initialState } from '../reducer'
import type { Action } from '../reducer'
import type {
  PriceSnapshot,
  MarketMeta,
  WhaleEvent,
  LiquidationEvent,
  FundingRateMap,
  EthGas,
} from '@sessionmap/types'

describe('reducer – initialState', () => {
  it('has prices for major symbols', () => {
    expect(initialState.prices).toHaveProperty('BTC')
    expect(initialState.prices).toHaveProperty('ETH')
    expect(initialState.prices).toHaveProperty('SOL')
  })

  it('starts with no whale events or liquidations', () => {
    expect(initialState.whaleEvents).toHaveLength(0)
    expect(initialState.liquidations).toHaveLength(0)
  })

  it('starts with globeMode auto and terminalMode false', () => {
    expect(initialState.globeMode).toBe('auto')
    expect(initialState.terminalMode).toBe(false)
  })

  it('starts with wsStatus connecting', () => {
    expect(initialState.wsStatus).toBe('connecting')
  })
})

describe('reducer – PRICES_UPDATE', () => {
  it('replaces the prices snapshot', () => {
    const newPrices: PriceSnapshot = { BTC: { price: 99999, change24h: 5.0 } }
    const action: Action = { type: 'PRICES_UPDATE', payload: newPrices }
    const next = reducer(initialState, action)
    expect(next.prices).toEqual(newPrices)
  })

  it('does not mutate other state fields', () => {
    const action: Action = { type: 'PRICES_UPDATE', payload: {} }
    const next = reducer(initialState, action)
    expect(next.globeMode).toBe(initialState.globeMode)
    expect(next.whaleEvents).toBe(initialState.whaleEvents)
  })
})

describe('reducer – META_UPDATE', () => {
  it('updates marketMeta', () => {
    const meta: MarketMeta = { fearGreed: 55, btcDominance: 52.3, totalMarketCap: 2e12 }
    const next = reducer(initialState, { type: 'META_UPDATE', payload: meta })
    expect(next.marketMeta).toEqual(meta)
  })
})

describe('reducer – WHALE_EVENT', () => {
  const whale: WhaleEvent = {
    id: 'whale-1',
    type: 'transfer',
    amount: 1000,
    from: 'Binance',
    to: 'Coinbase',
    ts: Date.now(),
  }

  it('prepends a new whale event', () => {
    const next = reducer(initialState, { type: 'WHALE_EVENT', payload: whale })
    expect(next.whaleEvents[0]).toEqual(whale)
    expect(next.whaleEvents).toHaveLength(1)
  })

  it('deduplicates events with the same id', () => {
    const state1 = reducer(initialState, { type: 'WHALE_EVENT', payload: whale })
    const state2 = reducer(state1, { type: 'WHALE_EVENT', payload: whale })
    expect(state2.whaleEvents).toHaveLength(1)
  })

  it('caps whale events at 30', () => {
    let state = initialState
    for (let i = 0; i < 35; i++) {
      state = reducer(state, {
        type: 'WHALE_EVENT',
        payload: { ...whale, id: `whale-${i}`, ts: Date.now() + i },
      })
    }
    expect(state.whaleEvents).toHaveLength(30)
  })
})

describe('reducer – LIQUIDATION_EVENT', () => {
  const liq: LiquidationEvent = {
    id: 'liq-1',
    symbol: 'BTC',
    side: 'LONG',
    qty: 0.5,
    price: 67000,
    usdValue: 33500,
    ts: Date.now(),
  }

  it('prepends a new liquidation event', () => {
    const next = reducer(initialState, { type: 'LIQUIDATION_EVENT', payload: liq })
    expect(next.liquidations[0]).toEqual(liq)
  })

  it('deduplicates liquidations with the same id', () => {
    const s1 = reducer(initialState, { type: 'LIQUIDATION_EVENT', payload: liq })
    const s2 = reducer(s1, { type: 'LIQUIDATION_EVENT', payload: liq })
    expect(s2.liquidations).toHaveLength(1)
  })

  it('caps liquidations at 30', () => {
    let state = initialState
    for (let i = 0; i < 35; i++) {
      state = reducer(state, {
        type: 'LIQUIDATION_EVENT',
        payload: { ...liq, id: `liq-${i}` },
      })
    }
    expect(state.liquidations).toHaveLength(30)
  })
})

describe('reducer – FUNDING_UPDATE', () => {
  it('replaces funding rates', () => {
    const rates: FundingRateMap = { BTC: 0.0001, ETH: -0.00025 }
    const next = reducer(initialState, { type: 'FUNDING_UPDATE', payload: rates })
    expect(next.fundingRates).toEqual(rates)
  })
})

describe('reducer – GAS_UPDATE', () => {
  it('updates ethGas', () => {
    const gas: EthGas = { slow: 10, standard: 20, fast: 40 }
    const next = reducer(initialState, { type: 'GAS_UPDATE', payload: gas })
    expect(next.ethGas).toEqual(gas)
  })
})

describe('reducer – SET_GLOBE_MODE', () => {
  it('updates globeMode', () => {
    const next = reducer(initialState, { type: 'SET_GLOBE_MODE', payload: 'heatmap' })
    expect(next.globeMode).toBe('heatmap')
  })
})

describe('reducer – TOGGLE_TERMINAL', () => {
  it('toggles terminalMode from false to true', () => {
    const next = reducer(initialState, { type: 'TOGGLE_TERMINAL' })
    expect(next.terminalMode).toBe(true)
  })

  it('toggles terminalMode back to false', () => {
    const s1 = reducer(initialState, { type: 'TOGGLE_TERMINAL' })
    const s2 = reducer(s1, { type: 'TOGGLE_TERMINAL' })
    expect(s2.terminalMode).toBe(false)
  })
})

describe('reducer – SET_TWEAK', () => {
  it('merges partial tweak values', () => {
    const next = reducer(initialState, {
      type: 'SET_TWEAK',
      payload: { rotationSpeed: 60 },
    })
    expect(next.tweaks.rotationSpeed).toBe(60)
    expect(next.tweaks.showTerminator).toBe(initialState.tweaks.showTerminator)
  })

  it('can update multiple tweaks at once', () => {
    const next = reducer(initialState, {
      type: 'SET_TWEAK',
      payload: { showSunMarker: false, markerPulse: false },
    })
    expect(next.tweaks.showSunMarker).toBe(false)
    expect(next.tweaks.markerPulse).toBe(false)
    expect(next.tweaks.rotationSpeed).toBe(initialState.tweaks.rotationSpeed)
  })
})

describe('reducer – SET_WS_STATUS', () => {
  it('updates wsStatus to connected', () => {
    const next = reducer(initialState, { type: 'SET_WS_STATUS', payload: 'connected' })
    expect(next.wsStatus).toBe('connected')
  })

  it('updates wsStatus to disconnected', () => {
    const next = reducer(initialState, { type: 'SET_WS_STATUS', payload: 'disconnected' })
    expect(next.wsStatus).toBe('disconnected')
  })
})

describe('reducer – unknown action', () => {
  it('returns the current state unchanged for unknown action types', () => {
    // @ts-expect-error testing unknown action
    const next = reducer(initialState, { type: 'UNKNOWN_ACTION' })
    expect(next).toBe(initialState)
  })
})
