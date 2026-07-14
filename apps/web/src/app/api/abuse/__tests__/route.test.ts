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
})
