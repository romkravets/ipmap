const MIN_RADIUS = 0.006
const MAX_RADIUS = 0.02
const SATURATION = 0.9
const LIGHTNESS = 0.55

export interface BlockVisual {
  radius: number
  hue: number
  saturation: number
  lightness: number
}

export function blockMarkerVisual(size: number, minSize: number, maxSize: number): BlockVisual {
  const logMin = Math.log10(Math.max(minSize, 1))
  const logMax = Math.log10(Math.max(maxSize, 1))
  const logSize = Math.log10(Math.max(size, 1))
  const ratio = logMax > logMin ? (logSize - logMin) / (logMax - logMin) : 1

  return {
    radius: MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS),
    hue: 0.6 - ratio * 0.55,
    saturation: SATURATION,
    lightness: LIGHTNESS,
  }
}
