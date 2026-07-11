export interface RdapInfo {
  name: string
  orgName: string | null
  abuseEmail: string | null
  registrationDate: string | null
  startAddress: string
  endAddress: string
  ipVersion: string
}

type RdapRaw = {
  name?: string
  handle?: string
  startAddress?: string
  endAddress?: string
  ipVersion?: string
  entities?: RdapEntity[]
  events?: Array<{ eventAction: string; eventDate: string }>
}

type RdapEntity = {
  vcardArray?: [string, Array<[string, Record<string, unknown>, string, string]>]
  roles?: string[]
  entities?: RdapEntity[]
}

function extractVcardField(entity: RdapEntity, fieldName: string): string | null {
  const vcard = entity.vcardArray?.[1]
  if (!vcard) return null
  const entry = vcard.find(([name]) => name === fieldName)
  return entry ? entry[3] : null
}

export function extractRdapInfo(raw: RdapRaw): RdapInfo {
  let orgName: string | null = null
  let abuseEmail: string | null = null

  for (const entity of raw.entities ?? []) {
    if (entity.roles?.includes('registrant') || entity.roles?.includes('administrative')) {
      orgName = orgName ?? extractVcardField(entity, 'fn')
      for (const sub of entity.entities ?? []) {
        if (sub.roles?.includes('abuse')) {
          abuseEmail = abuseEmail ?? extractVcardField(sub, 'email')
        }
      }
    }
  }

  const regEvent = raw.events?.find(e => e.eventAction === 'registration')

  return {
    name: raw.name ?? raw.handle ?? '',
    orgName,
    abuseEmail,
    registrationDate: regEvent?.eventDate ?? null,
    startAddress: raw.startAddress ?? '',
    endAddress: raw.endAddress ?? '',
    ipVersion: raw.ipVersion ?? 'v4',
  }
}

const rdapCache = new Map<string, RdapInfo>()

export async function fetchRdap(ip: string): Promise<RdapInfo | null> {
  if (rdapCache.has(ip)) return rdapCache.get(ip)!
  try {
    const res = await fetch(`https://rdap.org/ip/${ip}`)
    if (!res.ok) return null
    const raw = await res.json() as RdapRaw
    const info = extractRdapInfo(raw)
    rdapCache.set(ip, info)
    return info
  } catch {
    return null
  }
}
