import { describe, it, expect } from 'vitest'
import { parseIpData } from '../useIpData'

describe('parseIpData', () => {
  it('об\'єднує byCountry і centroids у CountryAlloc[]', () => {
    const ipv4 = {
      byCountry: { UA: 10000000, US: 1600000000 },
      blocksByCountry: {
        UA: [{ start: '193.108.0.0', size: 8192 }],
        US: [],
      },
    }
    const centroids = {
      UA: { lat: 48.4, lng: 31.2, name: 'Ukraine' },
      US: { lat: 38.7, lng: -97.4, name: 'United States' },
    }

    const result = parseIpData(ipv4, centroids)

    expect(result).toHaveLength(2)
    const ua = result.find(c => c.cc === 'UA')!
    expect(ua.ipCount).toBe(10000000)
    expect(ua.lat).toBe(48.4)
    expect(ua.lng).toBe(31.2)
    expect(ua.name).toBe('Ukraine')
  })

  it('пропускає країни без центроїда', () => {
    const ipv4 = {
      byCountry: { UA: 10000000, XX: 1000 },
      blocksByCountry: { UA: [], XX: [] },
    }
    const centroids = { UA: { lat: 48.4, lng: 31.2, name: 'Ukraine' } }

    const result = parseIpData(ipv4, centroids)
    expect(result).toHaveLength(1)
    expect(result[0].cc).toBe('UA')
  })
})
