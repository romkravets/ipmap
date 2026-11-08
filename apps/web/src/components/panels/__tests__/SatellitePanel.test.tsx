import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { SatelliteGroup } from '@ipmap/types'
import { SatellitePanel } from '../SatellitePanel'

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
})
