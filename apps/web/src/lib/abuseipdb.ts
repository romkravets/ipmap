export interface AbuseInfo {
  score: number
  totalReports: number
  isTor: boolean
  isp: string | null
  domain: string | null
  usageType: string | null
  lastReportedAt: string | null
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function isValidIpv4(ip: string): boolean {
  const match = IPV4_RE.exec(ip)
  if (!match) return false
  return match.slice(1, 5).every(octet => Number(octet) <= 255)
}

interface AbuseRawData {
  abuseConfidenceScore?: number
  totalReports?: number
  isTor?: boolean
  isp?: string | null
  domain?: string | null
  usageType?: string | null
  lastReportedAt?: string | null
}

interface AbuseRaw {
  data?: AbuseRawData
}

export function extractAbuseInfo(raw: AbuseRaw): AbuseInfo {
  const d = raw.data ?? {}
  return {
    score: d.abuseConfidenceScore ?? 0,
    totalReports: d.totalReports ?? 0,
    isTor: d.isTor ?? false,
    isp: d.isp ?? null,
    domain: d.domain ?? null,
    usageType: d.usageType ?? null,
    lastReportedAt: d.lastReportedAt ?? null,
  }
}

export function getAbuseColor(score: number): string {
  if (score >= 75) return '#ef4444'
  if (score >= 25) return '#facc15'
  return '#4ade80'
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const memoryCache = new Map<string, AbuseInfo>()

interface CacheEntry {
  data: AbuseInfo
  fetchedAt: number
}

function cacheKey(ip: string): string {
  return `abuseipdb:${ip}`
}

function readLocalStorage(ip: string): AbuseInfo | null {
  try {
    const raw = localStorage.getItem(cacheKey(ip))
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

function writeLocalStorage(ip: string, data: AbuseInfo): void {
  const entry: CacheEntry = { data, fetchedAt: Date.now() }
  localStorage.setItem(cacheKey(ip), JSON.stringify(entry))
}

export function getCachedAbuse(ip: string): AbuseInfo | null {
  const fromMemory = memoryCache.get(ip)
  if (fromMemory) return fromMemory
  const fromStorage = readLocalStorage(ip)
  if (fromStorage) memoryCache.set(ip, fromStorage)
  return fromStorage
}

export async function fetchAbuse(ip: string): Promise<AbuseInfo | null> {
  const cached = getCachedAbuse(ip)
  if (cached) return cached
  try {
    const res = await fetch(`/api/abuse?ip=${encodeURIComponent(ip)}`)
    if (!res.ok) return null
    const data = (await res.json()) as AbuseInfo
    memoryCache.set(ip, data)
    try {
      writeLocalStorage(ip, data)
    } catch {
      // кеш не критичний — повертаємо дані навіть якщо запис у localStorage не вдався
    }
    return data
  } catch {
    return null
  }
}
