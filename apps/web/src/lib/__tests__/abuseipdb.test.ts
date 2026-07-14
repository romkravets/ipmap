import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidIpv4, extractAbuseInfo, getAbuseColor, getCachedAbuse, fetchAbuse } from '../abuseipdb'

describe('isValidIpv4', () => {
  it('приймає валідну IPv4-адресу', () => {
    expect(isValidIpv4('193.108.0.0')).toBe(true)
    expect(isValidIpv4('8.8.8.8')).toBe(true)
  })

  it('відхиляє невалідний ввід', () => {
    expect(isValidIpv4('not-an-ip')).toBe(false)
    expect(isValidIpv4('999.999.999.999')).toBe(false)
    expect(isValidIpv4('1.2.3')).toBe(false)
    expect(isValidIpv4('1.2.3.4.5')).toBe(false)
    expect(isValidIpv4('')).toBe(false)
    expect(isValidIpv4('::1')).toBe(false)
  })
})

describe('extractAbuseInfo', () => {
  it('витягує поля з відповіді AbuseIPDB', () => {
    const raw = {
      data: {
        abuseConfidenceScore: 42,
        totalReports: 7,
        isTor: false,
        isp: 'Some ISP',
        domain: 'example.com',
        usageType: 'Data Center/Web Hosting/Transit',
        lastReportedAt: '2026-06-01T12:00:00Z',
      },
    }
    const info = extractAbuseInfo(raw)
    expect(info.score).toBe(42)
    expect(info.totalReports).toBe(7)
    expect(info.isTor).toBe(false)
    expect(info.isp).toBe('Some ISP')
    expect(info.domain).toBe('example.com')
    expect(info.usageType).toBe('Data Center/Web Hosting/Transit')
    expect(info.lastReportedAt).toBe('2026-06-01T12:00:00Z')
  })

  it('підставляє дефолти, коли поля відсутні', () => {
    const info = extractAbuseInfo({})
    expect(info.score).toBe(0)
    expect(info.totalReports).toBe(0)
    expect(info.isTor).toBe(false)
    expect(info.isp).toBeNull()
    expect(info.domain).toBeNull()
    expect(info.usageType).toBeNull()
    expect(info.lastReportedAt).toBeNull()
  })
})

describe('getAbuseColor', () => {
  it('повертає зелений для низького ризику', () => {
    expect(getAbuseColor(0)).toBe('#4ade80')
    expect(getAbuseColor(24)).toBe('#4ade80')
  })
  it('повертає жовтий для середнього ризику', () => {
    expect(getAbuseColor(25)).toBe('#facc15')
    expect(getAbuseColor(74)).toBe('#facc15')
  })
  it('повертає червоний для високого ризику', () => {
    expect(getAbuseColor(75)).toBe('#ef4444')
    expect(getAbuseColor(100)).toBe('#ef4444')
  })
})

const sampleInfo = {
  score: 10, totalReports: 1, isTor: false,
  isp: 'ISP', domain: null, usageType: null, lastReportedAt: null,
}

describe('getCachedAbuse / fetchAbuse', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getCachedAbuse повертає null, якщо кешу нема', () => {
    expect(getCachedAbuse('1.2.3.4')).toBeNull()
  })

  it('fetchAbuse не робить мережевий запит, якщо є валідний кеш у localStorage', async () => {
    localStorage.setItem(
      'abuseipdb:1.2.3.4',
      JSON.stringify({ data: sampleInfo, fetchedAt: Date.now() }),
    )
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAbuse('1.2.3.4')
    expect(result).toEqual(sampleInfo)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetchAbuse ігнорує прострочений кеш (TTL 24год) і йде в мережу', async () => {
    const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000
    localStorage.setItem(
      'abuseipdb:5.6.7.8',
      JSON.stringify({ data: sampleInfo, fetchedAt: staleTimestamp }),
    )
    const freshInfo = { ...sampleInfo, score: 99 }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(freshInfo),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAbuse('5.6.7.8')
    expect(fetchMock).toHaveBeenCalledWith('/api/abuse?ip=5.6.7.8')
    expect(result).toEqual(freshInfo)
  })

  it('fetchAbuse повертає null при мережевій помилці', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await fetchAbuse('9.9.9.9')
    expect(result).toBeNull()
  })

  it('fetchAbuse повертає fetched дані, навіть якщо запис у localStorage падає (наприклад, Safari private mode)', async () => {
    const freshInfo = { ...sampleInfo, score: 55 }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(freshInfo),
    })
    vi.stubGlobal('fetch', fetchMock)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    const result = await fetchAbuse('10.11.12.13')
    expect(result).toEqual(freshInfo)

    setItemSpy.mockRestore()
  })
})
