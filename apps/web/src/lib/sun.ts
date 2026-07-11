// Розраховує положення сонця за датою (для термінатора і follow-режиму)
export function getSunLatLng(date: Date): { lat: number; lng: number } {
  const doy = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const declination = -23.45 * Math.cos(((doy + 10) / 365) * 2 * Math.PI)
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const sunLng = (12 - utcH) * 15
  return { lat: declination, lng: sunLng }
}
