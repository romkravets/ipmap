import { describe, it, expect } from 'vitest'
import { blockMarkerVisual } from '../markerScale'

describe('blockMarkerVisual', () => {
  it('найменший блок отримує мінімальний радіус і холодний відтінок (hue=0.6)', () => {
    const v = blockMarkerVisual(1024, 1024, 1_000_000)
    expect(v.radius).toBeCloseTo(0.006, 5)
    expect(v.hue).toBeCloseTo(0.6, 5)
  })

  it('найбільший блок отримує максимальний радіус і теплий відтінок (hue=0.05)', () => {
    const v = blockMarkerVisual(1_000_000, 1024, 1_000_000)
    expect(v.radius).toBeCloseTo(0.02, 5)
    expect(v.hue).toBeCloseTo(0.05, 5)
  })

  it('коли всі блоки однакового розміру — не ділить на нуль, повертає максимальний радіус', () => {
    const v = blockMarkerVisual(4096, 4096, 4096)
    expect(v.radius).toBeCloseTo(0.02, 5)
    expect(Number.isFinite(v.hue)).toBe(true)
  })

  it('проміжний розмір дає проміжний радіус між min і max', () => {
    const v = blockMarkerVisual(32_000, 1024, 1_000_000)
    expect(v.radius).toBeGreaterThan(0.006)
    expect(v.radius).toBeLessThan(0.02)
  })

  it('saturation і lightness завжди 0.9 і 0.55 (узгоджено з маркерами країн)', () => {
    const v = blockMarkerVisual(2048, 1024, 1_000_000)
    expect(v.saturation).toBe(0.9)
    expect(v.lightness).toBe(0.55)
  })
})
