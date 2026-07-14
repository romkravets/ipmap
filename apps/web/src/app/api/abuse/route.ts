import { NextRequest, NextResponse } from 'next/server'
import { extractAbuseInfo, isValidIpv4 } from '@/lib/abuseipdb'

export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get('ip')
  if (!ip || !isValidIpv4(ip)) {
    return NextResponse.json({ error: 'невалідний ip' }, { status: 400 })
  }

  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AbuseIPDB не налаштовано' }, { status: 500 })
  }

  try {
    const upstream = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      { headers: { Key: apiKey, Accept: 'application/json' } },
    )
    if (!upstream.ok) {
      return NextResponse.json({ error: 'помилка апстріму' }, { status: 502 })
    }
    const raw = await upstream.json()
    return NextResponse.json(extractAbuseInfo(raw))
  } catch {
    return NextResponse.json({ error: 'помилка апстріму' }, { status: 502 })
  }
}
