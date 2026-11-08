import { describe, it, expect, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { SAT_OMM_FIELDS } from '@/lib/satellites/omm'
import issFixture from '@/lib/satellites/__fixtures__/iss-omm.json'

const call = (qs: string) => GET(new NextRequest(`http://localhost/api/satellites${qs}`))

describe('GET /api/satellites', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(Object.keys(body[0])).toEqual([...SAT_OMM_FIELDS])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
      expect.objectContaining({ next: { revalidate: 7200 } }),
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
})
