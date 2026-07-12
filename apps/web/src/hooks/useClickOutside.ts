import { useEffect, type RefObject } from 'react'

export function isOutsideClick(container: Element | null, target: EventTarget | null): boolean {
  if (!container) return false
  if (!(target instanceof Node)) return true
  return !container.contains(target)
}

export function useClickOutside(ref: RefObject<HTMLElement>, onOutside: () => void): void {
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (isOutsideClick(ref.current, e.target)) {
        onOutside()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [ref, onOutside])
}
