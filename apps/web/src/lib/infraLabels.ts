import type { DataCenter } from '@ipmap/types'

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
