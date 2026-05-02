'use client'

import { useState, useEffect, useRef, useActionState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import Map, { Marker, Source, Layer, NavigationControl, Popup } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import type { MapMouseEvent } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { selectedTripAtom, selectedDayIdAtom, suggestedLocationAtom, focusedLocationAtom, mapClickedDestinationAtom, routeModeAtom, dayRouteGeoJSONAtom } from '@/lib/store'
import { addLocationPoint } from '@/app/actions/addLocationPoint'
import { updateLocation } from '@/app/actions/updateLocation'
import type { TripWithDaysAndLocations, ActionState, LocationPoint, TransportMode } from '@/types'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const ROUTE_COLORS: Record<TransportMode, string> = {
  driving: '#ef4444',
  walking: '#22c55e',
  cycling: '#f59e0b',
  transit: '#8b5cf6',
  ferry: '#0ea5e9',
  flight: '#f97316',
}

type RenderedFeature = {
  layer: { id: string }
  properties: Record<string, string> | null
}

// Read names directly from what's painted on the map at the clicked pixel
function getNamesFromMap(mapRef: React.RefObject<MapRef | null>, point: { x: number; y: number }): string[] {
  const features = (mapRef.current?.queryRenderedFeatures(point as never) ?? []) as RenderedFeature[]
  const names: string[] = []

  for (const f of features) {
    const isPoi = ['poi-label', 'transit-label', 'airport-label'].includes(f.layer.id)
    if (isPoi) {
      const name = f.properties?.name_en || f.properties?.name
      if (name && !names.includes(name)) names.push(name)
    }
  }

  // Fall back to road name if no POI found
  if (names.length === 0) {
    for (const f of features) {
      if (f.layer.id === 'road-label') {
        const name = f.properties?.name_en || f.properties?.name
        if (name) { names.push(name); break }
      }
    }
  }

  return names.slice(0, 4)
}

async function reverseGeocodeApi(lat: number, lng: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${TOKEN}&types=poi,address&language=en`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.features ?? [])
      .map((f: { text?: string }) => f.text)
      .filter((t: string | undefined): t is string => Boolean(t))
  } catch {
    return []
  }
}

async function reverseGeocodeDestination(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${TOKEN}&types=place,region,country&language=en&limit=1`
    )
    if (!res.ok) return null
    const data = await res.json()
    const feature = data.features?.[0]
    if (!feature) return null

    const city = feature.text as string
    const context = (feature.context ?? []) as Array<{ id: string; text: string }>
    const country = context.find((c) => c.id.startsWith('country'))?.text
    return country ? `${city}, ${country}` : city
  } catch {
    return null
  }
}

async function forwardGeocode(query: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${TOKEN}&limit=1`
    )
    const data = await res.json()
    return (data.features?.[0]?.center as [number, number]) ?? null
  } catch {
    return null
  }
}

function fitLocations(
  mapRef: React.RefObject<MapRef | null>,
  locs: Array<{ lat: number; lng: number }>
): void {
  if (locs.length === 0) return
  if (locs.length === 1) {
    mapRef.current?.flyTo({ center: [locs[0].lng, locs[0].lat], zoom: 14, duration: 900 })
    return
  }
  const lngs = locs.map((l) => l.lng)
  const lats = locs.map((l) => l.lat)
  mapRef.current?.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 80, duration: 900, maxZoom: 15 }
  )
}

interface MapViewProps {
  trips: TripWithDaysAndLocations[]
}

interface PendingPoint {
  lat: number
  lng: number
  suggestions: string[]
  loading: boolean
}

export function MapView({ trips }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [mounted, setMounted] = useState(false)
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null)
  const [editingLocation, setEditingLocation] = useState<LocationPoint | null>(null)
  const selectedTrip = useAtomValue(selectedTripAtom)
  const selectedDayId = useAtomValue(selectedDayIdAtom)
  const [suggestedLocation, setSuggestedLocation] = useAtom(suggestedLocationAtom)
  const [focusedLocation, setFocusedLocation] = useAtom(focusedLocationAtom)
  const setMapClickedDestination = useSetAtom(mapClickedDestinationAtom)
  const routeMode = useAtomValue(routeModeAtom)
  const dayRouteGeoJSON = useAtomValue(dayRouteGeoJSONAtom)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!selectedTrip || !mounted) return
    forwardGeocode(selectedTrip.destination).then((coords) => {
      if (coords) mapRef.current?.flyTo({ center: coords, zoom: 10, duration: 1800 })
    })
  }, [selectedTrip?.id, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPendingPoint(null) }, [selectedDayId])

  useEffect(() => {
    if (!selectedDayId || !mounted || !currentDay) return
    const locs = [...currentDay.locations].sort((a, b) => a.orderIndex - b.orderIndex)
    if (locs.length === 0) return
    fitLocations(mapRef, locs)
  }, [selectedDayId, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusedLocation || !mounted) return
    mapRef.current?.flyTo({ center: [focusedLocation.lng, focusedLocation.lat], zoom: 14, duration: 900 })
    setFocusedLocation(null)
  }, [focusedLocation, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!suggestedLocation || !mounted) return
    mapRef.current?.flyTo({ center: [suggestedLocation.lng, suggestedLocation.lat], zoom: 15, duration: 1000 })
    setPendingPoint({ lat: suggestedLocation.lat, lng: suggestedLocation.lng, suggestions: [suggestedLocation.name], loading: false })
    setSuggestedLocation(null)
  }, [suggestedLocation, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentTrip = trips.find((t) => t.id === selectedTrip?.id) ?? null
  const currentDay = currentTrip?.days.find((d) => d.id === selectedDayId) ?? null
  const locations = [...(currentDay?.locations ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)

  const routeGeoJSON = {
    type: 'FeatureCollection' as const,
    features: locations.length > 1 ? [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: locations.map((p) => [p.lng, p.lat]),
      },
      properties: {},
    }] : [],
  }

  async function handleMapClick(e: MapMouseEvent) {
    const { lat, lng } = e.lngLat

    if (!selectedDayId) {
      const destination = await reverseGeocodeDestination(lat, lng)
      if (destination) setMapClickedDestination(destination)
      return
    }

    // 1. Instantly read what's painted on the map (synchronous)
    const rendered = getNamesFromMap(mapRef, e.point)

    // 2. Open popup immediately with whatever we have
    setPendingPoint({ lat, lng, suggestions: rendered, loading: rendered.length === 0 })

    // 3. If map had nothing, enrich from API
    if (rendered.length === 0) {
      const apiNames = await reverseGeocodeApi(lat, lng)
      setPendingPoint((prev) =>
        prev ? { ...prev, suggestions: apiNames, loading: false } : null
      )
    }
  }

  return (
    <div className="map-view">
      {selectedDayId && currentDay && (
        <div className="map-view__hint">
          Day {currentDay.dayNumber} selected — click the map to add a location
        </div>
      )}
      {mounted && (
        <Map
          ref={mapRef}
          initialViewState={{ longitude: 20, latitude: 30, zoom: 1.5 }}
          mapboxAccessToken={TOKEN}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onClick={handleMapClick}
          cursor={selectedDayId ? 'crosshair' : 'grab'}
        >
          <NavigationControl position="top-right" />

          {locations.length > 1 && (
            <Source id="route" type="geojson" data={dayRouteGeoJSON ?? routeGeoJSON}>
              {/* Driving / walking / cycling — single solid line */}
              <Layer
                id="route-main"
                type="line"
                filter={['!', ['has', 'segmentType']]}
                paint={dayRouteGeoJSON
                  ? {
                      'line-color': ['match', ['get', 'mode'],
                        'driving', ROUTE_COLORS.driving,
                        'walking', ROUTE_COLORS.walking,
                        'cycling', ROUTE_COLORS.cycling,
                        'transit', ROUTE_COLORS.transit,
                        'ferry', ROUTE_COLORS.ferry,
                        'flight', ROUTE_COLORS.flight,
                        '#9ca3af',
                      ],
                      'line-width': 4,
                      'line-opacity': 0.85,
                    }
                  : { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 1] }
                }
              />
              {/* Transit — solid purple line between stops */}
              <Layer
                id="route-transit"
                type="line"
                filter={['==', ['get', 'segmentType'], 'transit']}
                paint={{ 'line-color': ROUTE_COLORS.transit, 'line-width': 3, 'line-opacity': 0.9 }}
              />
              {/* Walk legs to/from stops — dashed gray */}
              <Layer
                id="route-walk"
                type="line"
                filter={['==', ['get', 'segmentType'], 'walk']}
                paint={{ 'line-color': '#374151', 'line-width': 2.5, 'line-dasharray': [3, 2], 'line-opacity': 0.75 }}
              />
            </Source>
          )}

          {locations.map((point, index) => (
            <Marker key={point.id} latitude={point.lat} longitude={point.lng}>
              <div
                className="map-marker"
                title={point.name}
                onClick={(e) => {
                  e.stopPropagation()
                  mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 15, duration: 800 })
                  setEditingLocation(point)
                  setPendingPoint(null)
                }}
              >
                <span className="map-marker__number">{index + 1}</span>
              </div>
            </Marker>
          ))}

          {pendingPoint && selectedDayId && (
            <Popup
              latitude={pendingPoint.lat}
              longitude={pendingPoint.lng}
              onClose={() => setPendingPoint(null)}
              closeOnClick={false}
              anchor="bottom"
            >
              <AddPointForm
                key={`${pendingPoint.lat}-${pendingPoint.lng}`}
                dayId={selectedDayId}
                lat={pendingPoint.lat}
                lng={pendingPoint.lng}
                suggestions={pendingPoint.suggestions}
                loading={pendingPoint.loading}
                onClose={() => setPendingPoint(null)}
              />
            </Popup>
          )}

          {editingLocation && (
            <Popup
              latitude={editingLocation.lat}
              longitude={editingLocation.lng}
              onClose={() => setEditingLocation(null)}
              closeOnClick={false}
              anchor="bottom"
            >
              <EditLocationForm
                key={editingLocation.id}
                location={editingLocation}
                onClose={() => setEditingLocation(null)}
              />
            </Popup>
          )}
        </Map>
      )}
    </div>
  )
}

const initialState: ActionState = {}

function EditLocationForm({ location, onClose }: { location: LocationPoint; onClose: () => void }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateLocation, {})

  useEffect(() => {
    if (state.success) { router.refresh(); onClose() }
  }, [state.success]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form className="edit-location-form" action={formAction}>
      <input type="hidden" name="id" value={location.id} />
      <label className="edit-location-form__label">Name</label>
      <input
        className="edit-location-form__input"
        name="name"
        type="text"
        defaultValue={location.name}
        required
        autoFocus
      />
      <label className="edit-location-form__label">Notes</label>
      <textarea
        className="edit-location-form__textarea"
        name="notes"
        defaultValue={location.notes ?? ''}
        placeholder="Add notes…"
        rows={3}
      />
      {state.error && <p className="edit-location-form__error">{state.error}</p>}
      <div className="edit-location-form__actions">
        <button type="button" className="edit-location-form__cancel" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={pending} className="edit-location-form__submit">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function AddPointForm({
  dayId, lat, lng, suggestions, loading, onClose,
}: {
  dayId: string
  lat: number
  lng: number
  suggestions: string[]
  loading: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(suggestions[0] ?? '')
  const [state, formAction, pending] = useActionState(addLocationPoint, initialState)

  // When async suggestions arrive after popup is open
  useEffect(() => {
    if (suggestions[0] && !name) setName(suggestions[0])
  }, [suggestions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.success) onClose()
  }, [state.success]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form className="add-point-form" action={formAction}>
      <input type="hidden" name="dayId" value={dayId} />
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />

      {loading ? (
        <p className="add-point-form__loading">Loading suggestions…</p>
      ) : suggestions.length > 0 ? (
        <div className="add-point-form__suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className={`add-point-form__chip${s === name ? ' add-point-form__chip--active' : ''}`}
              onClick={() => setName(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <input
        name="name"
        type="text"
        required
        placeholder="Location name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="add-point-form__input"
        autoFocus
      />
      {state.error && <p className="add-point-form__error">{state.error}</p>}
      <button type="submit" disabled={pending} className="add-point-form__submit">
        {pending ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}
