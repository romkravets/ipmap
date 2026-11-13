import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { SatelliteGroup } from '@ipmap/types'
import { useSatelliteData } from '../useSatelliteData'

const omm = (n: number) => ({ OBJECT_NAME: `S${n}`, NORAD_CAT_ID: n })

afterEach(() => vi.unstubAllGlobals())

function ok() {
  return vi.fn().mockImplementation(async () => ({ ok: true, json: async () => [omm(1)] }))
}

describe('useSatelliteData', () => {
  it('одна група -> один fetch, повторний рендер без нового', async () => {
    const f = ok()
    vi.stubGlobal('fetch', f)
    const { result, rerender } = renderHook(({ e }) => useSatelliteData(e), {
      initialProps: { e: ['stations'] as SatelliteGroup[] },
    })
    await waitFor(() => expect(result.current.data.stations).toHaveLength(1))
    rerender({ e: ['stations'] })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('додає starlink -> +1 fetch; вимкнення/увімкнення без нового', async () => {
    const f = ok()
    vi.stubGlobal('fetch', f)
    const { result, rerender } = renderHook(({ e }) => useSatelliteData(e), {
      initialProps: { e: ['stations'] as SatelliteGroup[] },
    })
    await waitFor(() => expect(result.current.data.stations).toBeDefined())
    rerender({ e: ['stations', 'starlink'] })
    await waitFor(() => expect(result.current.data.starlink).toBeDefined())
    expect(f).toHaveBeenCalledTimes(2)
    rerender({ e: ['stations'] })
    expect(result.current.data.starlink).toBeUndefined()
    rerender({ e: ['stations', 'starlink'] })
    await waitFor(() => expect(result.current.data.starlink).toBeDefined())
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('data зберігає посилання при ререндері з тим самим складом груп', async () => {
    vi.stubGlobal('fetch', ok())
    const { result, rerender } = renderHook(({ e }) => useSatelliteData(e), {
      initialProps: { e: ['stations'] as SatelliteGroup[] },
    })
    await waitFor(() => expect(result.current.data.stations).toBeDefined())
    const before = result.current.data
    rerender({ e: ['stations'] })
    expect(result.current.data).toBe(before)
    rerender({ e: ['stations'] })
    expect(result.current.data).toBe(before)
  })

  it('data отримує нове посилання після завершення fetch і зміни груп', async () => {
    vi.stubGlobal('fetch', ok())
    const { result, rerender } = renderHook(({ e }) => useSatelliteData(e), {
      initialProps: { e: ['stations'] as SatelliteGroup[] },
    })
    const initial = result.current.data
    await waitFor(() => expect(result.current.data.stations).toBeDefined())
    const loaded = result.current.data
    expect(loaded).not.toBe(initial)
    rerender({ e: ['stations', 'starlink'] })
    const enabledRef = result.current.data
    expect(enabledRef).not.toBe(loaded)
    await waitFor(() => expect(result.current.data.starlink).toBeDefined())
    expect(result.current.data).not.toBe(enabledRef)
    const withBoth = result.current.data
    rerender({ e: ['stations'] })
    expect(result.current.data).not.toBe(withBoth)
  })

  it('після помилки повторне вмикання робить новий fetch, помилка очищується', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [omm(1)] })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ ok: true, json: async () => [omm(2)] })
    vi.stubGlobal('fetch', f)
    const { result, rerender } = renderHook(({ e }) => useSatelliteData(e), {
      initialProps: { e: ['stations', 'starlink'] as SatelliteGroup[] },
    })
    await waitFor(() => expect(result.current.errors.starlink).toBeTruthy())
    expect(result.current.loading).toEqual([])
    rerender({ e: ['stations'] })
    rerender({ e: ['stations', 'starlink'] })
    await waitFor(() => expect(result.current.data.starlink).toHaveLength(1))
    expect(result.current.errors.starlink).toBeUndefined()
    expect(f).toHaveBeenCalledTimes(3)
  })
})
