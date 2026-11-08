import type { DataCenter, SatHoverItem } from '@ipmap/types'

// Текст hover-тултипа для супутника
export function formatSatelliteHover(item: SatHoverItem): { title: string; lines: string[] } {
  return {
    title: item.name,
    lines: [
      `NORAD ${item.noradId}`,
      `Висота: ${Math.round(item.altKm)} км`,
      `Швидкість: ${item.speedKmS.toFixed(2)} км/с`,
    ],
  }
}

const PROVIDER_LABELS: Record<DataCenter['provider'], string> = {
  aws: 'Amazon AWS',
  gcp: 'Google Cloud',
  azure: 'Microsoft Azure',
  equinix: 'Equinix',
  other: 'Інший провайдер',
}

export function getProviderLabel(provider: DataCenter['provider']): string {
  return PROVIDER_LABELS[provider] ?? PROVIDER_LABELS.other
}
