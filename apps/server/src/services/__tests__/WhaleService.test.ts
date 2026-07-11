import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the external dependencies before importing the module under test
vi.mock('../../ws/broadcaster.js', () => ({
  broadcast: vi.fn(),
}))

vi.mock('../../connectors/WhaleConnector.js', () => ({
  getLastRealWhaleTs: vi.fn(() => 0),
}))

import { startWhaleService } from '../WhaleService.js'
import { broadcast } from '../../ws/broadcaster.js'
import { getLastRealWhaleTs } from '../../connectors/WhaleConnector.js'

const mockBroadcast = vi.mocked(broadcast)
const mockGetLastRealWhaleTs = vi.mocked(getLastRealWhaleTs)

describe('startWhaleService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not broadcast immediately on start', () => {
    startWhaleService()
    expect(mockBroadcast).not.toHaveBeenCalled()
  })

  it('fires after the initial 5s delay when silence threshold is exceeded', () => {
    // getLastRealWhaleTs returns 0 → silentMs = Date.now() - 0, which is large
    mockGetLastRealWhaleTs.mockReturnValue(0)
    startWhaleService()
    // Advance past the 5s initial delay
    vi.advanceTimersByTime(5000)
    expect(mockBroadcast).toHaveBeenCalledTimes(1)
  })

  it('broadcasts a message with type "whale"', () => {
    mockGetLastRealWhaleTs.mockReturnValue(0)
    startWhaleService()
    vi.advanceTimersByTime(5000)
    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'whale' })
    )
  })

  it('broadcast payload contains a valid WhaleEvent structure', () => {
    mockGetLastRealWhaleTs.mockReturnValue(0)
    startWhaleService()
    vi.advanceTimersByTime(5000)
    const [call] = mockBroadcast.mock.calls
    const msg = call[0] as { type: string; data: Record<string, unknown> }
    expect(msg.data).toHaveProperty('id')
    expect(msg.data).toHaveProperty('type')
    expect(msg.data).toHaveProperty('amount')
    expect(msg.data).toHaveProperty('from')
    expect(msg.data).toHaveProperty('to')
    expect(msg.data).toHaveProperty('ts')
  })

  it('does NOT broadcast when silence is below threshold (real whale just fired)', () => {
    // Simulate a real whale event just happened (silentMs < 15000)
    mockGetLastRealWhaleTs.mockReturnValue(Date.now() - 5000)
    startWhaleService()
    vi.advanceTimersByTime(5000)
    expect(mockBroadcast).not.toHaveBeenCalled()
  })

  it('broadcast event amount is between 200 and 4700', () => {
    mockGetLastRealWhaleTs.mockReturnValue(0)
    startWhaleService()
    vi.advanceTimersByTime(5000)
    const [call] = mockBroadcast.mock.calls
    const msg = call[0] as { type: string; data: { amount: number } }
    expect(msg.data.amount).toBeGreaterThanOrEqual(200)
    expect(msg.data.amount).toBeLessThanOrEqual(4700)
  })

  it('from and to exchanges are different', () => {
    mockGetLastRealWhaleTs.mockReturnValue(0)
    // Run multiple times to increase confidence
    for (let i = 0; i < 20; i++) {
      vi.clearAllMocks()
      startWhaleService()
      vi.advanceTimersByTime(5000)
      const [call] = mockBroadcast.mock.calls
      const msg = call[0] as { type: string; data: { from: string; to: string } }
      expect(msg.data.from).not.toBe(msg.data.to)
      vi.advanceTimersByTime(10000)
    }
  })

  it('event id starts with "sim-"', () => {
    mockGetLastRealWhaleTs.mockReturnValue(0)
    startWhaleService()
    vi.advanceTimersByTime(5000)
    const [call] = mockBroadcast.mock.calls
    const msg = call[0] as { type: string; data: { id: string } }
    expect(msg.data.id).toMatch(/^sim-/)
  })
})
