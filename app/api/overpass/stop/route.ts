import { NextRequest, NextResponse } from 'next/server'

// Module-level cache: key = "lat3,lng3" (3 decimal places ≈ 110m grid)
const cache = new Map<string, { stop: object | null; ts: number }>()
const TTL_MS = 60 * 60 * 1000 // 1 hour

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  if (isNaN(lat) || isNaN(lng)) return NextResponse.json({ stop: null })

  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ stop: cached.stop })
  }

  const query =
    `[out:json][timeout:12];` +
    `(node["highway"="bus_stop"](around:600,${lat},${lng});` +
    `node["railway"="subway_entrance"](around:600,${lat},${lng});` +
    `node["railway"="station"](around:600,${lat},${lng});` +
    `node["railway"="tram_stop"](around:600,${lat},${lng});` +
    `node["public_transport"="stop_position"]["name"](around:600,${lat},${lng});` +
    `)->.stops;.stops out 10;` +
    `rel(bn.stops)["type"="route"]["route"~"bus|tram|subway|train|metro|ferry|monorail|light_rail"];out;`

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      cache.set(key, { stop: null, ts: Date.now() })
      return NextResponse.json({ stop: null })
    }
    const data = await res.json()
    const result = processOverpassResult(data, lat, lng)
    cache.set(key, { stop: result, ts: Date.now() })
    return NextResponse.json({ stop: result })
  } catch {
    return NextResponse.json({ stop: null })
  }
}

type OsmStopNode = { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
type OsmRoute = { type: 'relation'; tags?: Record<string, string>; members: Array<{ type: string; ref: number }> }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function processOverpassResult(data: { elements: Array<OsmStopNode | OsmRoute> }, lat: number, lng: number) {
  const elements = data.elements ?? []
  const nodes = elements.filter((e): e is OsmStopNode => e.type === 'node')
  const routes = elements.filter((e): e is OsmRoute => e.type === 'relation')
  if (!nodes.length) return null

  let best = nodes[0]
  let bestDist = haversine(lat, lng, best.lat, best.lon)
  for (const n of nodes.slice(1)) {
    const d = haversine(lat, lng, n.lat, n.lon)
    if (d < bestDist) { bestDist = d; best = n }
  }

  const servingRoutes = routes.filter((r) => r.members.some((m) => m.type === 'node' && m.ref === best.id))
  const lines = servingRoutes.map((r) => r.tags?.ref ?? r.tags?.short_name).filter(Boolean).slice(0, 6) as string[]
  const primaryRouteType = servingRoutes[0]?.tags?.route ?? 'bus'

  return { lat: best.lat, lng: best.lon, name: best.tags?.name ?? best.tags?.ref ?? 'Stop', lines, primaryRouteType }
}
