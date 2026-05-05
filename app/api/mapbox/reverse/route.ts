import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.MAPBOX_TOKEN ?? ''

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  if (!lat || !lng) return NextResponse.json({ features: [] })

  const types = searchParams.get('types') ?? 'place,region,country'
  const limit = searchParams.get('limit') ?? '1'

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?types=${types}&limit=${limit}&language=en&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ features: [] }, { status: 502 })
  }
}
