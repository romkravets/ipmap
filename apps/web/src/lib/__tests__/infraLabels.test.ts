import { describe, it, expect } from 'vitest'
import { getProviderLabel } from '../infraLabels'

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
