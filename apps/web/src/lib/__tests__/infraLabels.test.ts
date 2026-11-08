import { describe, it, expect } from 'vitest'
import { getProviderLabel, formatSatelliteHover } from '../infraLabels'

describe('formatSatelliteHover', () => {
  it('форматує назву, NORAD, висоту і швидкість', () => {
    expect(
      formatSatelliteHover({ name: 'ISS (ZARYA)', noradId: 25544, altKm: 417.3, speedKmS: 7.66 }),
    ).toEqual({
      title: 'ISS (ZARYA)',
      lines: ['NORAD 25544', 'Висота: 417 км', 'Швидкість: 7.66 км/с'],
    })
  })
})

describe('getProviderLabel', () => {
  it('мапить aws на людяну назву', () => {
    expect(getProviderLabel('aws')).toBe('Amazon AWS')
  })

  it('мапить gcp на людяну назву', () => {
    expect(getProviderLabel('gcp')).toBe('Google Cloud')
  })

  it('мапить azure на людяну назву', () => {
    expect(getProviderLabel('azure')).toBe('Microsoft Azure')
  })

  it('мапить equinix на людяну назву', () => {
    expect(getProviderLabel('equinix')).toBe('Equinix')
  })

  it('мапить other на "Інший провайдер"', () => {
    expect(getProviderLabel('other')).toBe('Інший провайдер')
  })
})
