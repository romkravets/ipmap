import { describe, it, expect } from 'vitest'
import { isOutsideClick } from '../useClickOutside'

describe('isOutsideClick', () => {
  it('повертає true, коли ціль кліку не є нащадком контейнера', () => {
    const container = document.createElement('div')
    const outsideTarget = document.createElement('span')
    document.body.append(container, outsideTarget)

    expect(isOutsideClick(container, outsideTarget)).toBe(true)
  })

  it('повертає false, коли ціль кліку є самим контейнером', () => {
    const container = document.createElement('div')
    document.body.append(container)

    expect(isOutsideClick(container, container)).toBe(false)
  })

  it('повертає false, коли ціль кліку є нащадком контейнера', () => {
    const container = document.createElement('div')
    const child = document.createElement('button')
    container.append(child)
    document.body.append(container)

    expect(isOutsideClick(container, child)).toBe(false)
  })

  it('повертає false, коли контейнер ще не змонтований (null)', () => {
    expect(isOutsideClick(null, document.createElement('div'))).toBe(false)
  })

  it('повертає true, коли ціль не є вузлом DOM', () => {
    const container = document.createElement('div')
    document.body.append(container)

    expect(isOutsideClick(container, null)).toBe(true)
  })
})
