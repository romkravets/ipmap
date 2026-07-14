import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('GET /api/abuse', () => {
  const originalKey = process.env.ABUSEIPDB_API_KEY

  beforeEach(() => {
    process.env.ABUSEIPDB_API_KEY = 'test-key'
  })
  afterEach(() => {
    process.env.ABUSEIPDB_API_KEY = originalKey
    vi.unstubAllGlobals()
  })

  it('повертає 400, якщо ip відсутній', async () => {
    const req = new NextRequest('http://localhost/api/abuse')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('повертає 400, якщо ip невалідний', async () => {
    const req = new NextRequest('http://localhost/api/abuse?ip=not-an-ip')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('повертає 500, якщо ABUSEIPDB_API_KEY не задано', async () => {
    delete process.env.ABUSEIPDB_API_KEY
    const req = new NextRequest('http://localhost/api/abuse?ip=8.8.8.8')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('повертає 200 з правильним AbuseInfo, без витоку ключа', async () => {
    const upstreamResponse = {
      data: {
        ipAddress: '8.8.8.8',
        abuseConfidenceScore: 42,
        totalReports: 3,
        isTor: false,
        isp: 'Test ISP',
        domain: 'example.com',
        usageType: 'Data Center',
        lastReportedAt: '2026-01-01T00:00:00Z',
      },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(upstreamResponse),
    })
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost/api/abuse?ip=8.8.8.8')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      score: 42,
      totalReports: 3,
      isTor: false,
      isp: 'Test ISP',
      domain: 'example.com',
      usageType: 'Data Center',
      lastReportedAt: '2026-01-01T00:00:00Z',
    })

    // Verify fetch was called with correct URL and headers
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('api.abuseipdb.com')
    expect(url).toContain('ipAddress=8.8.8.8')
    expect(opts?.headers?.Key).toBe('test-key')
  })

  it('повертає 502, якщо апстрім відповідає помилкою', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })
    vi.stubGlobal('fetch', fetchMock)

    const req = new NextRequest('http://localhost/api/abuse?ip=1.2.3.4')
    const res = await GET(req)

    expect(res.status).toBe(502)
  })
})
