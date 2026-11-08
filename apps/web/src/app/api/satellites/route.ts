import { NextRequest, NextResponse } from 'next/server'
import { compressOmm, isSatelliteGroup } from '@/lib/satellites/omm'

const BAD_GROUP = { error: 'невалідна група' }
const UPSTREAM_ERROR = { error: 'помилка апстріму' }

export async function GET(request: NextRequest) {
  const groups = request.nextUrl.searchParams.getAll('group')
  const group = groups[0]
  if (groups.length !== 1 || !isSatelliteGroup(group)) {
    return NextResponse.json(BAD_GROUP, { status: 400 })
  }

  try {
    const upstream = await fetch(
      `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`,
      { next: { revalidate: 7200 } },
    )
    if (!upstream.ok) {
      return NextResponse.json(UPSTREAM_ERROR, { status: 502 })
    }
    // CelesTrak може віддати 200 з не-JSON тілом ("No GP data found")
    const raw: unknown = JSON.parse(await upstream.text())
    const sats = compressOmm(raw)
    if (sats.length === 0) {
      return NextResponse.json(UPSTREAM_ERROR, { status: 502 })
    }
    return NextResponse.json(sats)
  } catch {
    return NextResponse.json(UPSTREAM_ERROR, { status: 502 })
  }
}
