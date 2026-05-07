'use client'

import { useState, useEffect, useRef, useActionState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import Map, { Marker, Source, Layer, NavigationControl, Popup } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import type { MapMouseEvent } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { selectedTripAtom, selectedDayIdAtom, suggestedLocationAtom, focusedLocationAtom, focusedLocationIdAtom, mapClickedDestinationAtom, dayRouteGeoJSONAtom, mealSuggestionsAtom, hoveredMealIdxAtom, showDaysAtom, showWishlistAtom } from '@/lib/store'
import { addLocationPoint } from '@/app/actions/addLocationPoint'
import { addToWishlist } from '@/app/actions/addToWishlist'
import { updateLocation } from '@/app/actions/updateLocation'
import type { TripWithDaysAndLocations, ActionState, LocationPoint, TransportMode } from '@/types'
import { UtensilsCrossed, Bookmark } from 'lucide-react'
import { dayColorIndex } from '@/lib/utils'

const MAP_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const ROUTE_COLORS: Record<TransportMode, string> = {
  driving: '#ef4444',
  walking: '#22c55e',
  cycling: '#f59e0b',
  transit: '#8b5cf6',
  ferry: '#0ea5e9',
  flight: '#f97316',
}

const DAY_COLORS = [
  '#2563eb', '#e11d48', '#16a34a', '#f97316',
  '#7c3aed', '#0d9488', '#ca8a04', '#9333ea',
  '#0891b2', '#b45309',
]

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
    const res = await fetch(`/api/mapbox/reverse?lat=${lat}&lng=${lng}&types=poi,address&limit=5`)
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
    const res = await fetch(`/api/mapbox/reverse?lat=${lat}&lng=${lng}&types=place,region,country&limit=1`)
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
    const res = await fetch(`/api/mapbox/geocode?query=${encodeURIComponent(query)}&limit=1`)
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
  stopType?: string
}

interface PendingWishlistPoint {
  lat: number
  lng: number
  suggestions: string[]
  loading: boolean
}

export function MapView({ trips }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [mounted, setMounted] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null)
  const [pendingWishlistPoint, setPendingWishlistPoint] = useState<PendingWishlistPoint | null>(null)
  const [editingLocation, setEditingLocation] = useState<LocationPoint | null>(null)
  const selectedTrip = useAtomValue(selectedTripAtom)
  const [selectedDayId, setSelectedDayId] = useAtom(selectedDayIdAtom)
  const [suggestedLocation, setSuggestedLocation] = useAtom(suggestedLocationAtom)
  const [focusedLocation, setFocusedLocation] = useAtom(focusedLocationAtom)
  const setMapClickedDestination = useSetAtom(mapClickedDestinationAtom)
  const [focusedLocationId, setFocusedLocationId] = useAtom(focusedLocationIdAtom)

  const dayRouteGeoJSON = useAtomValue(dayRouteGeoJSONAtom)
  const mealSuggestions = useAtomValue(mealSuggestionsAtom)
  const [hoveredMealIdx, setHoveredMealIdx] = useAtom(hoveredMealIdxAtom)
  const showDays = useAtomValue(showDaysAtom)
  const showWishlist = useAtomValue(showWishlistAtom)

  const currentTrip = trips.find((t) => t.id === selectedTrip?.id) ?? null
  const currentDay = currentTrip?.days.find((d) => d.id === selectedDayId && d.dayNumber > 0) ?? null

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!selectedTrip || !mapLoaded) return
    const freshTrip = trips.find((t) => t.id === selectedTrip.id)
    const allLocs = freshTrip?.days.flatMap((d) => d.locations) ?? []
    if (allLocs.length > 0) {
      fitLocations(mapRef, allLocs)
    } else {
      forwardGeocode(selectedTrip.destination).then((coords) => {
        if (coords) mapRef.current?.flyTo({ center: coords, zoom: 10, duration: 1800 })
      })
    }
  }, [selectedTrip?.id, mapLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPendingPoint(null) }, [selectedDayId])

  useEffect(() => {
    if (!mapLoaded) return
    if (selectedDayId && currentDay) {
      const locs = [...currentDay.locations].sort((a, b) => a.orderIndex - b.orderIndex)
      if (locs.length > 0) fitLocations(mapRef, locs)
    } else if (!selectedDayId && currentTrip) {
      const allLocs = currentTrip.days.flatMap((d) => d.locations)
      if (allLocs.length > 0) fitLocations(mapRef, allLocs)
    }
  }, [selectedDayId, mapLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusedLocation || !mapLoaded) return
    mapRef.current?.flyTo({ center: [focusedLocation.lng, focusedLocation.lat], zoom: 14, duration: 900 })
    setFocusedLocation(null)
  }, [focusedLocation, mapLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!suggestedLocation || !mapLoaded) return
    mapRef.current?.flyTo({ center: [suggestedLocation.lng, suggestedLocation.lat], zoom: 15, duration: 1000 })
    setPendingPoint({ lat: suggestedLocation.lat, lng: suggestedLocation.lng, suggestions: [suggestedLocation.name], loading: false, stopType: suggestedLocation.stopType })
    setSuggestedLocation(null)
  }, [suggestedLocation, mapLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showWishlist || !mapLoaded || !currentTrip) return
    const wlLocs = currentTrip.days.find((d) => d.dayNumber === 0)?.locations ?? []
    if (wlLocs.length === 0) return
    if (!showDays) fitLocations(mapRef, wlLocs)
  }, [showWishlist, mapLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const locations = [...(currentDay?.locations ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)

  const isOverview = (!selectedDayId || !currentDay) && !!currentTrip

  const overviewDays = isOverview
    ? currentTrip!.days
        .filter((day) => day.dayNumber > 0)
        .slice()
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .map((day) => ({
          ...day,
          locations: [...day.locations].sort((a, b) => a.orderIndex - b.orderIndex),
        }))
    : []

  const overviewRouteGeoJSON = {
    type: 'FeatureCollection' as const,
    features: overviewDays.flatMap((day) => {
      if (day.locations.length < 2) return []
      return [{
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: day.locations.map((l) => [l.lng, l.lat]),
        },
        properties: { color: DAY_COLORS[dayColorIndex(day.id)] },
      }]
    }),
  }

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
    setFocusedLocationId(null)

    if (!selectedDayId) {
      if (currentTrip) {
        // Trip open but no day selected — offer add to day or wishlist
        const rendered = getNamesFromMap(mapRef, e.point)
        setPendingWishlistPoint({ lat, lng, suggestions: rendered, loading: rendered.length === 0 })
        if (rendered.length === 0) {
          const apiNames = await reverseGeocodeApi(lat, lng)
          setPendingWishlistPoint((prev) => prev ? { ...prev, suggestions: apiNames, loading: false } : null)
        }
      } else {
        const destination = await reverseGeocodeDestination(lat, lng)
        if (destination) setMapClickedDestination(destination)
      }
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
          mapboxAccessToken={MAP_TOKEN}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          onLoad={() => setMapLoaded(true)}
          onClick={handleMapClick}
          cursor={selectedDayId ? 'crosshair' : 'grab'}
        >
          <NavigationControl position="top-right" />

          {/* Overview mode: all days with distinct colours */}
          {isOverview && showDays && overviewRouteGeoJSON.features.length > 0 && (
            <Source id="overview-route" type="geojson" data={overviewRouteGeoJSON}>
              <Layer
                id="overview-route-lines"
                type="line"
                paint={{
                  'line-color': ['get', 'color'],
                  'line-width': 3,
                  'line-opacity': 0.7,
                  'line-dasharray': [3, 1.5],
                }}
              />
            </Source>
          )}

          {isOverview && showDays && overviewDays.map((day) =>
            day.locations.map((point, locIdx) => (
              <Marker key={point.id} latitude={point.lat} longitude={point.lng}>
                <div
                  className={`map-marker map-marker--day-${dayColorIndex(day.id)}`}
                  title={`Day ${day.dayNumber}: ${point.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedDayId(day.id)
                    setFocusedLocationId(point.id)
                    setFocusedLocation({ lat: point.lat, lng: point.lng })
                  }}
                >
                  <span className="map-marker__number">{locIdx + 1}</span>
                </div>
              </Marker>
            ))
          )}

          {/* Wishlist markers */}
          {showWishlist && currentTrip?.days.find((d) => d.dayNumber === 0)?.locations.map((point) => (
            <Marker key={`wl-${point.id}`} latitude={point.lat} longitude={point.lng} style={{ zIndex: focusedLocationId === point.id ? 100 : undefined }}>
              <div
                className={`map-marker map-marker--wishlist${focusedLocationId === point.id ? ' map-marker--wishlist--focused' : ''}`}
                title={point.name}
                onClick={(e) => {
                  e.stopPropagation()
                  setFocusedLocationId(point.id)
                  mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 14, duration: 900 })
                }}
              >
                <Bookmark size={11} color="white" strokeWidth={2.5} />
              </div>
            </Marker>
          ))}

          {/* Single-day mode: current day route + markers */}
          {!isOverview && locations.length > 1 && (
            <Source id="route" type="geojson" data={dayRouteGeoJSON ?? routeGeoJSON}>
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
              <Layer
                id="route-transit"
                type="line"
                filter={['==', ['get', 'segmentType'], 'transit']}
                paint={{ 'line-color': ROUTE_COLORS.transit, 'line-width': 3, 'line-opacity': 0.9 }}
              />
              <Layer
                id="route-walk"
                type="line"
                filter={['==', ['get', 'segmentType'], 'walk']}
                paint={{ 'line-color': '#374151', 'line-width': 2.5, 'line-dasharray': [3, 2], 'line-opacity': 0.75 }}
              />
            </Source>
          )}

          {!isOverview && locations.map((point, index) => (
            <Marker key={point.id} latitude={point.lat} longitude={point.lng}>
              <div
                className={`map-marker${focusedLocationId === point.id ? ' map-marker--focused' : point.visited ? ' map-marker--visited' : ''}`}
                title={point.name}
                onClick={(e) => {
                  e.stopPropagation()
                  mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 15, duration: 800 })
                  setFocusedLocationId(point.id)
                  setPendingPoint(null)
                }}
              >
                <span className="map-marker__number">{index + 1}</span>
              </div>
            </Marker>
          ))}

          {mealSuggestions.map((s, i) => (
            <Marker key={`meal-${s.lat}-${s.lng}`} latitude={s.lat} longitude={s.lng} style={{ zIndex: hoveredMealIdx === i ? 1000 : 10 }}>
              <div
                className={`map-marker map-marker--meal${hoveredMealIdx === i ? ' map-marker--meal--active' : ''}`}
                onMouseEnter={() => setHoveredMealIdx(i)}
                onMouseLeave={() => setHoveredMealIdx(null)}
              >
                <UtensilsCrossed size={11} color="white" strokeWidth={2.5} />
                <span className="map-marker__meal-tooltip">{s.englishName ?? s.name}</span>
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
                dayNumber={currentDay?.dayNumber}
                lat={pendingPoint.lat}
                lng={pendingPoint.lng}
                suggestions={pendingPoint.suggestions}
                loading={pendingPoint.loading}
                stopType={pendingPoint.stopType}
                tripId={currentTrip?.id}
                otherDays={currentTrip?.days.filter((d) => d.dayNumber > 0 && d.id !== selectedDayId) ?? []}
                onClose={() => setPendingPoint(null)}
              />
            </Popup>
          )}

          {pendingWishlistPoint && currentTrip && (
            <Popup
              latitude={pendingWishlistPoint.lat}
              longitude={pendingWishlistPoint.lng}
              onClose={() => setPendingWishlistPoint(null)}
              closeOnClick={false}
              anchor="bottom"
            >
              <WishlistAddForm
                key={`wl-${pendingWishlistPoint.lat}-${pendingWishlistPoint.lng}`}
                tripId={currentTrip.id}
                lat={pendingWishlistPoint.lat}
                lng={pendingWishlistPoint.lng}
                suggestions={pendingWishlistPoint.suggestions}
                loading={pendingWishlistPoint.loading}
                days={currentTrip.days.filter((d) => d.dayNumber > 0)}
                onSelectDay={(dayId: string) => {
                  setPendingWishlistPoint(null)
                  setSelectedDayId(dayId)
                  setPendingPoint({ lat: pendingWishlistPoint.lat, lng: pendingWishlistPoint.lng, suggestions: pendingWishlistPoint.suggestions, loading: false })
                }}
                onClose={() => setPendingWishlistPoint(null)}
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

function WishlistAddForm({
  tripId, lat, lng, suggestions, loading, days, onSelectDay, onClose,
}: {
  tripId: string
  lat: number
  lng: number
  suggestions: string[]
  loading: boolean
  days: { id: string; dayNumber: number }[]
  onSelectDay: (dayId: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(suggestions[0] ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false)

  useEffect(() => {
    if (suggestions[0] && !name) setName(suggestions[0])
  }, [suggestions]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddToWishlist() {
    if (!name.trim()) return
    setSaving(true)
    const result = await addToWishlist(tripId, lat, lng, name.trim())
    if (result.error) { setError(result.error); setSaving(false); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="add-point-form">
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
        type="text"
        required
        placeholder="Location name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="add-point-form__input"
        autoFocus
      />
      {error && <p className="add-point-form__error">{error}</p>}
      {days.length > 0 && (
        <div className="wishlist-popup__day-wrap">
          <button
            type="button"
            className="wishlist-popup__day-toggle"
            onClick={() => setDayDropdownOpen((o) => !o)}
          >
            Add to day
            <span className="wishlist-popup__day-caret">{dayDropdownOpen ? '▴' : '▾'}</span>
          </button>
          {dayDropdownOpen && (
            <div className="wishlist-popup__day-menu">
              {[...days].sort((a, b) => a.dayNumber - b.dayNumber).map((d) => {
                const color = DAY_COLORS[dayColorIndex(d.id)]
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="wishlist-popup__day-btn"
                    onClick={() => onSelectDay(d.id)}
                  >
                    <span className="wishlist-popup__day-dot" style={{ background: color }} />
                    Day {d.dayNumber}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      <div className="wishlist-popup__divider" />
      <button
        type="button"
        disabled={saving || !name.trim()}
        className="wishlist-popup__save-btn"
        onClick={handleAddToWishlist}
      >
        <Bookmark size={13} />
        {saving ? 'Saving…' : 'Save to Wishlist'}
      </button>
    </div>
  )
}

function AddPointForm({
  dayId, dayNumber, lat, lng, suggestions, loading, stopType, tripId, otherDays, onClose,
}: {
  dayId: string
  dayNumber?: number
  lat: number
  lng: number
  suggestions: string[]
  loading: boolean
  stopType?: string
  tripId?: string
  otherDays?: { id: string; dayNumber: number }[]
  onClose: () => void
}) {
  const router = useRouter()
  const uniqueSuggestions = [...new Set(suggestions)]
  const [name, setName] = useState(uniqueSuggestions[0] ?? '')
  const [state, formAction, pending] = useActionState(addLocationPoint, initialState)
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false)
  const [savingWishlist, setSavingWishlist] = useState(false)

  useEffect(() => {
    if (uniqueSuggestions[0] && !name) setName(uniqueSuggestions[0])
  }, [suggestions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.success) onClose()
  }, [state.success]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveWishlist() {
    if (!tripId || !name.trim()) return
    setSavingWishlist(true)
    await addToWishlist(tripId, lat, lng, name.trim())
    router.refresh()
    onClose()
  }

  return (
    <form className="add-point-form" action={formAction}>
      <input type="hidden" name="dayId" value={dayId} />
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <input type="hidden" name="stopType" value={stopType ?? 'place'} />

      {loading ? (
        <p className="add-point-form__loading">Loading suggestions…</p>
      ) : uniqueSuggestions.length > 0 ? (
        <div className="add-point-form__suggestions">
          {uniqueSuggestions.map((s) => (
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
        {pending ? 'Adding…' : dayNumber ? `Add to Day ${dayNumber}` : 'Add to day'}
      </button>

      {(otherDays && otherDays.length > 0) && (
        <div className="wishlist-popup__day-wrap">
          <button
            type="button"
            className="wishlist-popup__day-toggle"
            onClick={() => setDayDropdownOpen((o) => !o)}
          >
            Add to another day
            <span className="wishlist-popup__day-caret">{dayDropdownOpen ? '▴' : '▾'}</span>
          </button>
          {dayDropdownOpen && (
            <div className="wishlist-popup__day-menu">
              {[...otherDays].sort((a, b) => a.dayNumber - b.dayNumber).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="wishlist-popup__day-btn"
                  onClick={() => {
                    const fd = new FormData()
                    fd.set('dayId', d.id)
                    fd.set('lat', String(lat))
                    fd.set('lng', String(lng))
                    fd.set('name', name)
                    fd.set('stopType', stopType ?? 'place')
                    void addLocationPoint({}, fd).then(() => { router.refresh(); onClose() })
                  }}
                >
                  <span className="wishlist-popup__day-dot" style={{ background: DAY_COLORS[dayColorIndex(d.id)] }} />
                  Day {d.dayNumber}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tripId && (
        <>
          <div className="wishlist-popup__divider" />
          <button
            type="button"
            disabled={savingWishlist || !name.trim()}
            className="wishlist-popup__save-btn"
            onClick={handleSaveWishlist}
          >
            <Bookmark size={13} />
            {savingWishlist ? 'Saving…' : 'Save to Wishlist'}
          </button>
        </>
      )}
    </form>
  )
}
