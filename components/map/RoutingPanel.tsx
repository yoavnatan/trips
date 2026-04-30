'use client'

import { useState } from 'react'

export type TransportMode = 'driving' | 'walking' | 'cycling' | 'transit'

export type RouteGeoJSON = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'LineString'; coordinates: number[][] }
    properties: Record<string, string>
  }>
}

interface RoutingPanelProps {
  token: string
  onRouteUpdate: (geojson: RouteGeoJSON | null, mode: TransportMode | null) => void
}

interface RouteInfo {
  distance: string
  duration: string
}

const MODE_ICONS: Record<TransportMode, string> = {
  driving: '🚗',
  walking: '🚶',
  cycling: '🚲',
  transit: '🚌',
}

async function geocodePlace(query: string, token: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${token}&limit=1`
    )
    if (!res.ok) return null
    const data = await res.json()
    return (data.features?.[0]?.center as [number, number]) ?? null
  } catch {
    return null
  }
}

// Public transit boilerplate — swap in your preferred provider:
//   Navitia:       GET  https://api.navitia.io/v1/journeys?from={lng};{lat}&to={lng};{lat}
//                       Authorization: 'YOUR_NAVITIA_TOKEN'
//   Google Routes: POST https://routes.googleapis.com/directions/v2:computeRoutes
//                       X-Goog-Api-Key: 'YOUR_GOOGLE_KEY', travelMode: 'TRANSIT'
// Currently returns a straight-line placeholder path.
async function fetchTransitRoute(
  from: [number, number],
  to: [number, number]
): Promise<{ geojson: RouteGeoJSON; distance: string; duration: string }> {
  return {
    geojson: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [from, to] }, properties: {} }],
    },
    distance: '—',
    duration: '—',
  }
}

async function fetchDirectionsRoute(
  from: [number, number],
  to: [number, number],
  mode: Exclude<TransportMode, 'transit'>,
  token: string
): Promise<{ geojson: RouteGeoJSON | null; distance: string; duration: string }> {
  try {
    const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}` +
        `?access_token=${token}&geometries=geojson&overview=full`
    )
    if (!res.ok) return { geojson: null, distance: '', duration: '' }
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return { geojson: null, distance: '', duration: '' }

    const km = (route.distance / 1000).toFixed(1)
    const mins = Math.round(route.duration / 60)
    const hrs = Math.floor(mins / 60)
    const durationStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`

    return {
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: route.geometry as { type: 'LineString'; coordinates: number[][] },
          properties: {},
        }],
      },
      distance: `${km} km`,
      duration: durationStr,
    }
  } catch {
    return { geojson: null, distance: '', duration: '' }
  }
}

export function RoutingPanel({ token, onRouteUpdate }: RoutingPanelProps) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<TransportMode>('driving')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)

  function clearRoute() {
    setRouteInfo(null)
    setError(null)
    onRouteUpdate(null, null)
  }

  function handleClose() {
    setOpen(false)
    clearRoute()
  }

  function handleSwap() {
    setFrom(to)
    setTo(from)
    clearRoute()
  }

  async function handleGetRoute() {
    if (!from.trim() || !to.trim()) return
    setLoading(true)
    setError(null)
    setRouteInfo(null)
    onRouteUpdate(null, null)

    const [fromCoords, toCoords] = await Promise.all([
      geocodePlace(from, token),
      geocodePlace(to, token),
    ])

    if (!fromCoords || !toCoords) {
      setError('Could not find one of the locations.')
      setLoading(false)
      return
    }

    const result = mode === 'transit'
      ? await fetchTransitRoute(fromCoords, toCoords)
      : await fetchDirectionsRoute(fromCoords, toCoords, mode, token)

    if (!result.geojson) {
      setError('Could not calculate route.')
      setLoading(false)
      return
    }

    setRouteInfo({ distance: result.distance, duration: result.duration })
    onRouteUpdate(result.geojson, mode)
    setLoading(false)
  }

  if (!open) {
    return (
      <button className="routing-toggle" onClick={() => setOpen(true)} title="Route planner">
        ↗
      </button>
    )
  }

  return (
    <div className="routing-panel">
      <div className="routing-panel__header">
        <span className="routing-panel__title">Route Planner</span>
        <button className="routing-panel__close" onClick={handleClose} aria-label="Close">✕</button>
      </div>

      <div className="routing-panel__modes">
        {(['driving', 'walking', 'cycling', 'transit'] as TransportMode[]).map((m) => (
          <button
            key={m}
            className={`routing-panel__mode${mode === m ? ' routing-panel__mode--active' : ''}`}
            onClick={() => { setMode(m); clearRoute() }}
            title={m.charAt(0).toUpperCase() + m.slice(1)}
          >
            {MODE_ICONS[m]}
          </button>
        ))}
      </div>

      <div className="routing-panel__fields">
        <input
          className="routing-panel__input"
          placeholder="From…"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGetRoute()}
        />
        <button className="routing-panel__swap" onClick={handleSwap} title="Swap from / to">⇅</button>
        <input
          className="routing-panel__input"
          placeholder="To…"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGetRoute()}
        />
      </div>

      {error && <p className="routing-panel__error">{error}</p>}

      {routeInfo && (
        <div className="routing-panel__result">
          <span className="routing-panel__result-mode">{MODE_ICONS[mode]}</span>
          <span className="routing-panel__result-info">
            {routeInfo.distance} · {routeInfo.duration}
          </span>
        </div>
      )}

      <button
        className="routing-panel__go"
        onClick={handleGetRoute}
        disabled={loading || !from.trim() || !to.trim()}
      >
        {loading ? 'Calculating…' : 'Get Route'}
      </button>

      {mode === 'transit' && (
        <p className="routing-panel__note">
          Transit shows a direct path. Wire up a transit API for real routes.
        </p>
      )}
    </div>
  )
}
