import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { SAT_OMM_FIELDS } from '@/lib/satellites/omm'
import { __resetSatelliteCacheForTests } from '@/lib/satellites/serverCache'
import issFixture from '@/lib/satellites/__fixtures__/iss-omm.json'

const call = (qs: string) => GET(new NextRequest(`http://localhost/api/satellites${qs}`))

const okFetch = () =>
  vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([{ ...issFixture[0], OBJECT_ID: '1998-067A' }])),
    }),
  )

describe('GET /api/satellites', () => {
  beforeEach(() => {
    __resetSatelliteCacheForTests()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it.each([
    ['', 'group відсутній'],
    ['?group=foo', 'невідома група'],
    ['?group=__proto__', '__proto__'],
    ['?group=STARLINK', 'регістр'],
    ['?group=starlink&group=gps-ops', 'дубль group'],
  ])('повертає 400 для "%s" (%s) без виклику fetch', async (qs) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'невалідна група' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('повертає 200 зі стиснутим масивом і кешем 7200', async () => {
    const raw = [{ ...issFixture[0], OBJECT_ID: '1998-067A' }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(raw)),
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await call('?group=stations')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=7200, stale-while-revalidate=3600',
    )
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(Object.keys(body[0])).toEqual([...SAT_OMM_FIELDS])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
      { cache: 'no-store' },
    )
  })

  it('повертає 502, якщо апстрім !ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const res = await call('?group=stations')
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'помилка апстріму' })
  })

  it('повертає 502, якщо апстрім кидає', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect((await call('?group=stations')).status).toBe(502)
  })

  it('повертає 502, якщо тіло не JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('No GP data found'),
        json: () => Promise.reject(new SyntaxError('bad json')),
      }),
    )
    expect((await call('?group=stations')).status).toBe(502)
  })

  it('повертає 502, якщо після стискання порожньо', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('[]') }),
    )
    expect((await call('?group=stations')).status).toBe(502)
  })

  it('другий запит у межах TTL не викликає fetch', async () => {
    const fetchMock = okFetch()
    vi.stubGlobal('fetch', fetchMock)
    await call('?group=stations')
    const res = await call('?group=stations')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('після TTL робить fetch знову', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const fetchMock = okFetch()
    vi.stubGlobal('fetch', fetchMock)
    await call('?group=stations')
    vi.setSystemTime(new Date('2026-01-01T02:00:01Z'))
    await call('?group=stations')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('два одночасні запити — один fetch', async () => {
    const fetchMock = okFetch()
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([call('?group=stations'), call('?group=stations')])
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('не кешує не-JSON і порожню відповідь', async () => {
    const bad = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('No GP data found') })
    vi.stubGlobal('fetch', bad)
    expect((await call('?group=stations')).status).toBe(502)
    const empty = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('[]') })
    vi.stubGlobal('fetch', empty)
    expect((await call('?group=stations')).status).toBe(502)
    expect(empty).toHaveBeenCalledTimes(1)
    const good = okFetch()
    vi.stubGlobal('fetch', good)
    expect((await call('?group=stations')).status).toBe(200)
    expect(good).toHaveBeenCalledTimes(1)
  })

  it('апстрім впав, але є застарілий кеш — віддає його з 200', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    vi.stubGlobal('fetch', okFetch())
    await call('?group=stations')
    vi.setSystemTime(new Date('2026-01-01T03:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const res = await call('?group=stations')
    expect(res.status).toBe(200)
    expect((await res.json())[0].OBJECT_NAME).toBe(issFixture[0].OBJECT_NAME)
  })

  it('відкидає GEO-записи', async () => {
    const leo = { ...issFixture[0], OBJECT_NAME: 'LEO' }
    const geo = { ...issFixture[0], OBJECT_NAME: 'GEO', MEAN_MOTION: 1.0027 }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify([leo, geo])) }),
    )
    const body = await (await call('?group=weather')).json()
    expect(body.map((s: { OBJECT_NAME: string }) => s.OBJECT_NAME)).toEqual(['LEO'])
  })
})
