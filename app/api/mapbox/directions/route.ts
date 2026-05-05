import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.MAPBOX_TOKEN ?? ''

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') // "lng,lat"
  const to = searchParams.get('to')     // "lng,lat"
  const mode = searchParams.get('mode') ?? 'walking'
  if (!from || !to) return NextResponse.json({ routes: [] })

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${mode}/${from};${to}` +
    `?geometries=geojson&overview=full&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ routes: [] }, { status: 502 })
  }
}
