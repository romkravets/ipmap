import { NextRequest, NextResponse } from 'next/server'
import { isSatelliteGroup } from '@/lib/satellites/omm'
import { getSatellites } from '@/lib/satellites/serverCache'

const BAD_GROUP = { error: 'невалідна група' }
const UPSTREAM_ERROR = { error: 'помилка апстріму' }
const CACHE_CONTROL = 'public, s-maxage=7200, stale-while-revalidate=3600'

export async function GET(request: NextRequest) {
  const groups = request.nextUrl.searchParams.getAll('group')
  const group = groups[0]
  if (groups.length !== 1 || !isSatelliteGroup(group)) {
    return NextResponse.json(BAD_GROUP, { status: 400 })
  }

  const sats = await getSatellites(group)
  if (!sats) return NextResponse.json(UPSTREAM_ERROR, { status: 502 })
  return NextResponse.json(sats, { headers: { 'Cache-Control': CACHE_CONTROL } })
}
