import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchSatelliteGroup } from '../client'

afterEach(() => vi.unstubAllGlobals())

describe('fetchSatelliteGroup', () => {
  it('звертається до /api/satellites?group=starlink', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', f)
    await fetchSatelliteGroup('starlink')
    expect(f).toHaveBeenCalledWith('/api/satellites?group=starlink')
  })

  it('502 -> reject', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }))
    await expect(fetchSatelliteGroup('starlink')).rejects.toThrow()
  })
})
