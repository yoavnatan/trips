import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.MAPBOX_TOKEN ?? ''

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const query = searchParams.get('query')
  if (!query) return NextResponse.json({ features: [] })

  const types = searchParams.get('types') ?? 'place,locality,region,country'
  const limit = searchParams.get('limit') ?? '5'

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?types=${types}&limit=${limit}&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ features: [] }, { status: 502 })
  }
}
