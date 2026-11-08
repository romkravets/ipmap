import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { SatelliteGroup } from '@ipmap/types'
import { SatellitePanel } from '../SatellitePanel'
import { compressOmm } from '@/lib/satellites/omm'
import { createPropagator } from '@/lib/satellites/propagator'
import fixture from '@/lib/satellites/__fixtures__/iss-omm.json'

const w = window as unknown as { globeLayers?: Record<string, boolean> }
const none: SatelliteGroup[] = []
const base = { enabled: none, data: {}, loading: none, errors: {}, onToggle: () => {} }

beforeEach(() => { w.globeLayers = undefined })

describe('SatellitePanel', () => {
  it('рендерить 6 чекбоксів', () => {
    render(<SatellitePanel {...base} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
  })

  it('клік по Starlink викликає onToggle', () => {
    const onToggle = vi.fn()
    render(<SatellitePanel {...base} onToggle={onToggle} />)
    fireEvent.click(screen.getByLabelText('Starlink'))
    expect(onToggle).toHaveBeenCalledWith('starlink')
  })

  it('показує лічильник', () => {
    const sat = { OBJECT_NAME: 'a', NORAD_CAT_ID: 1 } as never
    render(<SatellitePanel {...base} enabled={['starlink']} data={{ starlink: [sat, sat, sat] }} />)
    expect(screen.getByText('Starlink на орбіті зараз: 3')).toBeTruthy()
  })

  it('показує помилку групи', () => {
    render(<SatellitePanel {...base} enabled={['oneweb']} errors={{ oneweb: 'Не вдалося завантажити' }} />)
    expect(screen.getByText(/Не вдалося завантажити/)).toBeTruthy()
  })

  it('показує індикатор завантаження', () => {
    render(<SatellitePanel {...base} enabled={['gps-ops']} loading={['gps-ops']} />)
    expect(screen.getByText(/Завантаження/)).toBeTruthy()
  })

  it('нічого не рендерить при вимкненому шарі', () => {
    w.globeLayers = { satellites: false }
    const { container } = render(<SatellitePanel {...base} />)
    act(() => { window.dispatchEvent(new Event('globe-layers-changed')) })
    expect(container.firstChild).toBeNull()
  })

  describe('Над Кременцем зараз', () => {
    const iss = compressOmm(fixture)[0]
    const epochMs = Date.parse(iss.EPOCH)
    const p = createPropagator()
    p.load([iss])
    const [lat, lng] = p.positionsAt(epochMs)
    const under = { lat, lng, altKm: 0 }
    const anti = { lat: -lat, lng: lng > 0 ? lng - 180 : lng + 180, altKm: 0 }
    const name = 'Над Кременцем зараз'

    it('показує МКС над спостерігачем після кліку', () => {
      render(<SatellitePanel {...base} enabled={['stations']} data={{ stations: [iss] }} observer={under} nowMs={epochMs} />)
      fireEvent.click(screen.getByRole('button', { name }))
      expect(screen.getByText(/ISS/)).toBeTruthy()
    })

    it('в антиподі показує повідомлення про відсутність', () => {
      render(<SatellitePanel {...base} enabled={['stations']} data={{ stations: [iss] }} observer={anti} nowMs={epochMs} />)
      fireEvent.click(screen.getByRole('button', { name }))
      expect(screen.getByText('Зараз над Кременцем немає супутників вище 10°')).toBeTruthy()
    })

    it('кнопка вимкнена, коли немає даних', () => {
      render(<SatellitePanel {...base} />)
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    })
  })
})
