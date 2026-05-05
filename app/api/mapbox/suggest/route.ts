import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.MAPBOX_TOKEN ?? ''

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  if (!category || !lat || !lng) return NextResponse.json({ features: [] })

  const limit = searchParams.get('limit') ?? '3'

  const url =
    `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}` +
    `?proximity=${lng},${lat}&limit=${limit}&access_token=${TOKEN}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ features: [] }, { status: 502 })
  }
}
