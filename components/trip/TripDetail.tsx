'use client'

import { useState, useEffect, useMemo } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Car, Footprints, Bike, Bus, TramFront, Train, Ship,
  Plane, Clock,
  ChevronDown, ChevronUp, ArrowUpDown, Check, X,
  GripVertical, ArrowLeft, CalendarDays, Share2, MapPin, Navigation,
  MoreVertical, Trash2,
} from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import 'react-day-picker/src/style.css'
import { selectedDayIdAtom, suggestedLocationAtom, focusedLocationAtom, segmentModesAtom, segmentSummaryAtom, dayRouteGeoJSONAtom } from '@/lib/store'
import { addDay } from '@/app/actions/addDay'
import { deleteLocation } from '@/app/actions/deleteLocation'
import { deleteDay } from '@/app/actions/deleteDay'
import { reorderLocations } from '@/app/actions/reorderLocations'
import { updateLocation } from '@/app/actions/updateLocation'
import { updateTrip } from '@/app/actions/updateTrip'
import { haversineDistance, formatDistance } from '@/lib/utils'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { TripWithDaysAndLocations, ActionState, SuggestedLocation, LocationPoint, TransportMode, RouteGeoJSON } from '@/types'

interface ConfirmState {
  title: string
  message: string
  onConfirm: () => void
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const MODE_LABELS: Record<TransportMode, string> = {
  driving: 'Drive',
  walking: 'Walk',
  cycling: 'Cycle',
  transit: 'Transit',
  ferry: 'Ferry',
  flight: 'Flight',
}

const TRANSIT_TYPE_LABELS: Record<string, string> = {
  bus: 'Bus', tram: 'Tram', subway: 'Metro',
  metro: 'Metro', train: 'Train', ferry: 'Ferry',
  monorail: 'Monorail', light_rail: 'Light Rail',
}

function ModeIcon({ mode, size = 14 }: { mode: TransportMode; size?: number }) {
  if (mode === 'driving') return <Car size={size} />
  if (mode === 'walking') return <Footprints size={size} />
  if (mode === 'cycling') return <Bike size={size} />
  if (mode === 'ferry') return <Ship size={size} />
  if (mode === 'flight') return <Plane size={size} />
  return <Bus size={size} />
}

function TransitTypeIcon({ type, size = 13 }: { type: string; size?: number }) {
  if (type === 'tram') return <TramFront size={size} />
  if (type === 'ferry') return <Ship size={size} />
  if (type === 'train' || type === 'subway' || type === 'metro' || type === 'monorail' || type === 'light_rail')
    return <Train size={size} />
  return <Bus size={size} />
}

function formatTripDateRange(startDate: Date | null, endDate: Date | null): string | null {
  if (!startDate) return null
  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!endDate) return fmt(startDate)
  const endYear = new Date(endDate).getFullYear()
  return `${fmt(startDate)} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: endYear !== new Date(startDate).getFullYear() ? 'numeric' : undefined })}`
}

function getDayDate(startDate: Date, dayNumber: number): string {
  const d = new Date(startDate)
  d.setDate(d.getDate() + dayNumber - 1)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

interface TripDetailProps {
  trip: TripWithDaysAndLocations
  onBack: () => void
}

const initialState: ActionState = {}

async function fetchNearbySuggestions(lat: number, lng: number, exclude: string[]): Promise<SuggestedLocation[]> {
  const categories = ['tourist_attraction', 'historic_site', 'art_gallery', 'viewpoint', 'museum']

  const results = await Promise.all(
    categories.map(async (category): Promise<SuggestedLocation | null> => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/category/${category}` +
            `?proximity=${lng},${lat}&limit=3&access_token=${TOKEN}`
        )
        if (!res.ok) return null
        const data = await res.json()
        const features = (data.features ?? []) as Array<{ properties: { name: string }; geometry: { coordinates: [number, number] } }>
        const pick = features.find(f => !exclude.includes(f.properties.name))
        if (!pick) return null
        return {
          name: pick.properties.name,
          lng: pick.geometry.coordinates[0],
          lat: pick.geometry.coordinates[1],
        }
      } catch {
        return null
      }
    })
  )
  return results.filter((r): r is SuggestedLocation => r !== null)
}

export function TripDetail({ trip, onBack }: TripDetailProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(addDay, initialState)
  const [selectedDayId, setSelectedDayId] = useAtom(selectedDayIdAtom)
  const segmentModes = useAtomValue(segmentModesAtom)
  const setSuggestedLocation = useSetAtom(suggestedLocationAtom)
  const setFocusedLocation = useSetAtom(focusedLocationAtom)
  const [suggestions, setSuggestions] = useState<SuggestedLocation[]>([])
  const [suggestingForDayId, setSuggestingForDayId] = useState<string | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [seenNames, setSeenNames] = useState<Record<string, string[]>>({})
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null)
  const [deletingDayId, setDeletingDayId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null)
  const [copied, setCopied] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [menuOpenDayId, setMenuOpenDayId] = useState<string | null>(null)

  useEffect(() => {
    if (!menuOpenDayId) return
    function handleOutsideClick() { setMenuOpenDayId(null) }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [menuOpenDayId])

  async function handleShare(): Promise<void> {
    const url = `${window.location.origin}/share/${trip.shareToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDayClick(dayId: string): void {
    const nextId = dayId === selectedDayId ? null : dayId
    setSelectedDayId(nextId)
    setSuggestions([])
    setSuggestingForDayId(null)
    setReorderMode(false)
  }

  async function handleRangeSelect(range: DateRange | undefined): Promise<void> {
    const result = await updateTrip(trip.id, range?.from ?? null, range?.to ?? null)
    if (result.error) {
      console.error('Date save failed:', result.error)
      return
    }
    router.refresh()
    if (range?.from && range?.to) setShowDatePicker(false)
  }

  async function handleSuggest(dayId: string, lat: number, lng: number): Promise<void> {
    setSuggestingForDayId(dayId)
    setSuggestLoading(true)
    setSuggestions([])
    const exclude = seenNames[dayId] ?? []
    const results = await fetchNearbySuggestions(lat, lng, exclude)
    setSeenNames((prev) => ({
      ...prev,
      [dayId]: [...(prev[dayId] ?? []), ...results.map((r) => r.name)],
    }))
    setSuggestions(results)
    setSuggestLoading(false)
  }

  function handleSuggestionClick(loc: SuggestedLocation): void {
    setSuggestedLocation(loc)
    setSuggestions([])
    setSuggestingForDayId(null)
  }

  function handleDeleteLocation(locationId: string, locationName: string): void {
    setConfirmModal({
      title: 'Remove location?',
      message: `"${locationName}" will be removed from this day.`,
      onConfirm: async () => {
        setConfirmModal(null)
        setDeletingLocationId(locationId)
        await deleteLocation(locationId)
        router.refresh()
        setDeletingLocationId(null)
      },
    })
  }

  function handleDeleteDay(dayId: string, dayNumber: number, locationCount: number): void {
    const extra = locationCount > 0
      ? ` This will also remove its ${locationCount} location${locationCount !== 1 ? 's' : ''}.`
      : ''
    setConfirmModal({
      title: `Delete Day ${dayNumber}?`,
      message: `Day ${dayNumber} will be permanently deleted.${extra}`,
      onConfirm: async () => {
        setConfirmModal(null)
        setDeletingDayId(dayId)
        if (selectedDayId === dayId) setSelectedDayId(null)
        await deleteDay(dayId)
        router.refresh()
        setDeletingDayId(null)
      },
    })
  }

  const startDate = trip.startDate ? new Date(trip.startDate) : null
  const endDate = trip.endDate ? new Date(trip.endDate) : null
  const formattedDateRange = formatTripDateRange(startDate, endDate)

  return (
    <div className="trip-detail">
      <button className="trip-detail__back" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="trip-detail__header">
        <div className="trip-detail__header-top">
          <h2 className="trip-detail__title">{trip.title}</h2>
          <div className="trip-detail__header-actions">
            <button
              className={`trip-detail__date-btn${showDatePicker ? ' trip-detail__date-btn--open' : ''}`}
              onClick={() => setShowDatePicker((p) => !p)}
              title="Set trip dates"
            >
              <CalendarDays size={14} />
              <span>{formattedDateRange ?? 'Add dates'}</span>
            </button>
            <button
              className={`trip-detail__share-btn${copied ? ' trip-detail__share-btn--copied' : ''}`}
              onClick={() => void handleShare()}
            >
              {copied ? (
                <><Check size={11} /> Copied!</>
              ) : (
                <><Share2 size={11} /> Share</>
              )}
            </button>
          </div>
        </div>
        <p className="trip-detail__destination">{trip.destination}</p>

        {showDatePicker && (
          <div className="trip-detail__date-picker-wrap">
            <DayPicker
              mode="range"
              selected={{ from: startDate ?? undefined, to: endDate ?? undefined }}
              onSelect={(range) => void handleRangeSelect(range)}
            />
          </div>
        )}
      </div>

      <div className="trip-detail__days">
        <h3 className="trip-detail__days-heading">Days</h3>
        {trip.days.length === 0 ? (
          <div className="trip-detail__empty">
            <p>No days yet.</p>
            <p className="trip-detail__empty-hint">Add your first day below, then click the map to drop location pins.</p>
          </div>
        ) : (
          <ul className="day-list">
            {trip.days.map((day) => {
              const isOpen = day.id === selectedDayId
              const locs = [...day.locations].sort((a, b) => a.orderIndex - b.orderIndex)

              let totalDist = 0
              for (let i = 1; i < locs.length; i++) {
                totalDist += haversineDistance(locs[i - 1].lat, locs[i - 1].lng, locs[i].lat, locs[i].lng)
              }

              const lastLoc = locs[locs.length - 1]
              const difficulty = computeDayDifficulty(locs, segmentModes)
              const dayDate = startDate ? getDayDate(startDate, day.dayNumber) : null

              return (
                <li key={day.id} className={`day-list__item${isOpen ? ' day-list__item--active' : ''}`}>
                  <div className="day-list__header-row">
                    <button className="day-list__header" onClick={() => handleDayClick(day.id)}>
                      <span className="day-list__chevron">
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                      <span className="day-list__number-col">
                        <span className="day-list__number">Day {day.dayNumber}</span>
                        {dayDate && <span className="day-list__date">{dayDate}</span>}
                      </span>
                      <span className="day-list__meta">
                        <span className="day-list__count">
                          {locs.length} loc{locs.length !== 1 ? 's' : ''}
                        </span>
                        {locs.length > 1 && (
                          <span className="day-list__total-dist">{formatDistance(totalDist)}</span>
                        )}
                        {difficulty && (
                          <span className={`day-list__difficulty day-list__difficulty--${difficulty}`}>
                            {difficulty}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="day-list__menu">
                      <button
                        className="day-list__menu-trigger"
                        onClick={(e) => { e.stopPropagation(); setMenuOpenDayId(menuOpenDayId === day.id ? null : day.id) }}
                        title="Day options"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {menuOpenDayId === day.id && (
                        <div className="day-list__menu-dropdown">
                          {isOpen && locs.length >= 2 && (
                            <button
                              className={`day-list__menu-item${reorderMode ? ' day-list__menu-item--active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setReorderMode((m) => !m); setMenuOpenDayId(null) }}
                            >
                              <ArrowUpDown size={13} />
                              {reorderMode ? 'Stop reordering' : 'Reorder'}
                            </button>
                          )}
                          <button
                            className="day-list__menu-item day-list__menu-item--danger"
                            disabled={deletingDayId === day.id}
                            onClick={(e) => { e.stopPropagation(); setMenuOpenDayId(null); handleDeleteDay(day.id, day.dayNumber, locs.length) }}
                          >
                            <Trash2 size={13} />
                            Delete day
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="day-list__body">
                      {day.summary && <p className="day-list__summary">{day.summary}</p>}

                      {locs.length === 0 ? (
                        <p className="day-list__hint">Click anywhere on the map to add your first location</p>
                      ) : (
                        <SortableLocationList
                          locs={locs}
                          deletingLocationId={deletingLocationId}
                          reorderMode={reorderMode}
                          onFocus={(loc) => setFocusedLocation({ lat: loc.lat, lng: loc.lng })}
                          onDelete={(loc) => handleDeleteLocation(loc.id, loc.name)}
                        />
                      )}

                      {locs.length >= 2 && <DayRoute locs={locs} />}

                      {lastLoc && (
                        <div className="day-list__suggest">
                          <button
                            className="day-list__suggest-btn"
                            onClick={() => handleSuggest(day.id, lastLoc.lat, lastLoc.lng)}
                            disabled={suggestLoading && suggestingForDayId === day.id}
                          >
                            {suggestLoading && suggestingForDayId === day.id ? 'Loading…' : '+ Suggest next location'}
                          </button>
                          {suggestingForDayId === day.id && suggestions.length > 0 && (
                            <ul className="suggest-list">
                              {suggestions.map((s) => (
                                <li key={`${s.lat}-${s.lng}`} className="suggest-list__item">
                                  <button
                                    className="suggest-list__btn"
                                    onClick={() => handleSuggestionClick(s)}
                                  >
                                    {s.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      <p className="day-list__hint">Click the map to add another location</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      <form className="add-day-form" action={formAction}>
        <input type="hidden" name="tripId" value={trip.id} />
        <input
          name="summary"
          type="text"
          placeholder="Day summary (optional)"
          className="add-day-form__input"
        />
        {state.error && <p className="add-day-form__error">{state.error}</p>}
        <button type="submit" disabled={pending} className="add-day-form__submit">
          {pending ? 'Adding…' : '+ Add Day'}
        </button>
      </form>
    </div>
  )
}


function fmtDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  const hrs = Math.floor(mins / 60)
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
}


function estimateTransitSecs(distKm: number, routeType: string): number {
  const speeds: Record<string, number> = {
    bus: 18, tram: 16, subway: 35, metro: 35,
    train: 60, ferry: 25, monorail: 30, light_rail: 25,
  }
  return Math.round((distKm / (speeds[routeType] ?? 20)) * 3600)
}

type TransitStop = { lat: number; lng: number; name: string; lines: string[]; primaryRouteType: string }
type WalkResult = { coordinates: number[][]; distKm: number; durSecs: number }
type OsmStopNode = { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
type OsmRoute = { type: 'relation'; tags?: Record<string, string>; members: Array<{ type: string; ref: number }> }

async function findNearestStop(lat: number, lng: number): Promise<TransitStop | null> {
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
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query })
    if (!res.ok) return null
    const data = await res.json()
    const elements = data.elements as Array<OsmStopNode | OsmRoute>

    const nodes = elements.filter((e): e is OsmStopNode => e.type === 'node')
    const routes = elements.filter((e): e is OsmRoute => e.type === 'relation')
    if (!nodes.length) return null

    let best = nodes[0]
    let bestDist = haversineDistance(lat, lng, best.lat, best.lon)
    for (const n of nodes.slice(1)) {
      const d = haversineDistance(lat, lng, n.lat, n.lon)
      if (d < bestDist) { bestDist = d; best = n }
    }

    const servingRoutes = routes.filter((r) => r.members.some((m) => m.type === 'node' && m.ref === best.id))
    const lines = servingRoutes.map((r) => r.tags?.ref ?? r.tags?.short_name).filter((s): s is string => Boolean(s)).slice(0, 6)
    const primaryRouteType = servingRoutes[0]?.tags?.route ?? 'bus'

    return { lat: best.lat, lng: best.lon, name: best.tags?.name ?? best.tags?.ref ?? 'Stop', lines, primaryRouteType }
  } catch {
    return null
  }
}

async function fetchWalkRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }, token: string): Promise<WalkResult | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?access_token=${token}&geometries=geojson&overview=full`
    )
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null
    return {
      coordinates: route.geometry.coordinates as number[][],
      distKm: (route.distance as number) / 1000,
      durSecs: route.duration as number,
    }
  } catch {
    return null
  }
}


async function fetchSegmentRoute(
  from: LocationPoint,
  to: LocationPoint,
  mode: Exclude<TransportMode, 'transit'>,
  token: string
): Promise<{ distance: string; duration: string; distKm: number; durSecs: number; geojson: RouteGeoJSON } | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}` +
        `?access_token=${token}&geometries=geojson&overview=full`
    )
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null
    const distKm = (route.distance as number) / 1000
    const durSecs = route.duration as number
    return {
      distance: formatDistance(distKm),
      duration: fmtDuration(durSecs),
      distKm,
      durSecs,
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: route.geometry as { type: 'LineString'; coordinates: number[][] },
          properties: { mode },
        }],
      },
    }
  } catch {
    return null
  }
}

type SegResult = {
  distance: string
  duration: string
  distKm: number
  durSecs: number
  geojson: RouteGeoJSON | null
  transitType?: string
  transitLines?: string[]
} | null | 'loading'

function computeDayDifficulty(locs: LocationPoint[], segmentModes: Record<string, TransportMode>): 'easy' | 'moderate' | 'hard' | null {
  if (locs.length < 2) return null
  let activeKm = 0
  let totalKm = 0
  for (let i = 0; i < locs.length - 1; i++) {
    const from = locs[i]
    const to = locs[i + 1]
    const distKm = haversineDistance(from.lat, from.lng, to.lat, to.lng)
    const mode = segmentModes[`${from.id}-${to.id}`] ?? suggestMode(distKm)
    totalKm += distKm
    if (mode === 'walking' || mode === 'cycling') activeKm += distKm
  }
  if (activeKm > 8 || totalKm > 50) return 'hard'
  if (activeKm > 3 || totalKm > 15) return 'moderate'
  return 'easy'
}

function suggestMode(distKm: number): TransportMode {
  if (distKm < 1.5) return 'walking'
  if (distKm < 25) return 'transit'
  if (distKm < 300) return 'driving'
  return 'flight'
}

function straightLineTransitResult(from: LocationPoint, to: LocationPoint): SegResult {
  const distKm = haversineDistance(from.lat, from.lng, to.lat, to.lng)
  const durSecs = estimateTransitSecs(distKm, 'bus')
  return {
    distance: formatDistance(distKm),
    duration: `~${fmtDuration(durSecs)}`,
    distKm,
    durSecs,
    geojson: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }, properties: { mode: 'transit' } }],
    },
  }
}

async function checkFerryTerminals(lat1: number, lng1: number, lat2: number, lng2: number): Promise<boolean> {
  const radius = 8000
  const hasTerminal = async (lat: number, lng: number): Promise<boolean> => {
    const q =
      `[out:json][timeout:6];` +
      `(node["amenity"="ferry_terminal"](around:${radius},${lat},${lng});` +
      `way["amenity"="ferry_terminal"](around:${radius},${lat},${lng});` +
      `rel["route"="ferry"](around:${radius},${lat},${lng});` +
      `);out count;`
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q })
      if (!res.ok) return false
      const data = await res.json() as { elements?: Array<{ tags?: { total?: string } }> }
      return parseInt(data.elements?.[0]?.tags?.total ?? '0') > 0
    } catch {
      return false
    }
  }
  const [a, b] = await Promise.all([hasTerminal(lat1, lng1), hasTerminal(lat2, lng2)])
  return a && b
}

function straightLineFerryResult(from: LocationPoint, to: LocationPoint): SegResult {
  const distKm = haversineDistance(from.lat, from.lng, to.lat, to.lng)
  const durSecs = Math.round((distKm / 25) * 3600)
  return {
    distance: formatDistance(distKm),
    duration: `~${fmtDuration(durSecs)}`,
    distKm,
    durSecs,
    geojson: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }, properties: { mode: 'ferry' } }],
    },
  }
}

function straightLineFlightResult(from: LocationPoint, to: LocationPoint): SegResult {
  const distKm = haversineDistance(from.lat, from.lng, to.lat, to.lng)
  const durSecs = Math.round((distKm / 300) * 3600)
  return {
    distance: formatDistance(distKm),
    duration: `~${fmtDuration(durSecs)}`,
    distKm,
    durSecs,
    geojson: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }, properties: { mode: 'flight' } }],
    },
  }
}

async function fetchSegmentTransit(from: LocationPoint, to: LocationPoint): Promise<SegResult> {
  const [fromStop, toStop] = await Promise.all([
    findNearestStop(from.lat, from.lng),
    findNearestStop(to.lat, to.lng),
  ])

  const routeType = fromStop?.primaryRouteType ?? 'bus'

  if (!fromStop && !toStop) return straightLineTransitResult(from, to)

  const [walkFrom, walkTo] = await Promise.all([
    fromStop ? fetchWalkRoute(from, fromStop, TOKEN) : Promise.resolve(null),
    toStop ? fetchWalkRoute(toStop, to, TOKEN) : Promise.resolve(null),
  ])

  const features: RouteGeoJSON['features'] = []
  let totalDistKm = 0
  let totalDurSecs = 0

  if (fromStop && walkFrom) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: walkFrom.coordinates }, properties: { mode: 'walking' } })
    totalDistKm += walkFrom.distKm
    totalDurSecs += walkFrom.durSecs
  }

  const txFrom = fromStop ?? from
  const txTo = toStop ?? to
  const txDistKm = haversineDistance(txFrom.lat, txFrom.lng, txTo.lat, txTo.lng)
  const txDurSecs = estimateTransitSecs(txDistKm, routeType)
  features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[txFrom.lng, txFrom.lat], [txTo.lng, txTo.lat]] }, properties: { mode: 'transit' } })
  totalDistKm += txDistKm
  totalDurSecs += txDurSecs

  if (toStop && walkTo) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: walkTo.coordinates }, properties: { mode: 'walking' } })
    totalDistKm += walkTo.distKm
    totalDurSecs += walkTo.durSecs
  }

  return {
    distance: formatDistance(totalDistKm),
    duration: `~${fmtDuration(totalDurSecs)}`,
    distKm: totalDistKm,
    durSecs: totalDurSecs,
    geojson: { type: 'FeatureCollection', features },
    transitType: routeType,
    transitLines: fromStop?.lines,
  }
}

function SegmentRoutePanel({ from, to }: { from: LocationPoint; to: LocationPoint }) {
  const segKey = `${from.id}-${to.id}`
  const [segmentModes, setSegmentModes] = useAtom(segmentModesAtom)
  const activeMode = segmentModes[segKey] ?? 'walking'
  const distKm = haversineDistance(from.lat, from.lng, to.lat, to.lng)
  const showFlight = distKm > 150 || activeMode === 'flight'
  const [showFerry, setShowFerry] = useState(activeMode === 'ferry')
  const [results, setResults] = useState<Record<TransportMode, SegResult>>({
    driving: 'loading', walking: 'loading', cycling: 'loading', transit: 'loading',
    ferry: straightLineFerryResult(from, to), flight: straightLineFlightResult(from, to),
  })

  useEffect(() => {
    ;(['driving', 'walking', 'cycling'] as Array<Exclude<TransportMode, 'transit' | 'ferry' | 'flight'>>).forEach((m) => {
      fetchSegmentRoute(from, to, m, TOKEN).then((r) => {
        setResults((prev) => ({ ...prev, [m]: r }))
      })
    })
    setResults((prev) => ({
      ...prev,
      transit: straightLineTransitResult(from, to),
      ferry: straightLineFerryResult(from, to),
      flight: straightLineFlightResult(from, to),
    }))
    fetchSegmentTransit(from, to).then((r) => {
      setResults((prev) => ({ ...prev, transit: r }))
    })
    checkFerryTerminals(from.lat, from.lng, to.lat, to.lng).then((has) => {
      if (has) setShowFerry(true)
    })
  }, [from.id, to.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleModes = (['driving', 'walking', 'cycling', 'transit'] as TransportMode[])
    .concat(showFerry ? ['ferry' as TransportMode] : [])
    .concat(showFlight ? ['flight' as TransportMode] : [])

  return (
    <div className="segment-route">
      {visibleModes.map((m) => {
        const r = results[m]
        return (
          <button
            key={m}
            className={`segment-route__card${activeMode === m ? ' segment-route__card--active' : ''}`}
            onClick={() => setSegmentModes((prev) => ({ ...prev, [segKey]: m }))}
          >
            <span className="segment-route__icon"><ModeIcon mode={m} size={16} /></span>
            <span className="segment-route__label">{MODE_LABELS[m]}</span>
            {r === 'loading' ? (
              <span className="segment-route__meta">…</span>
            ) : r ? (
              <>
                {m === 'transit' && r.transitType && (
                  <span className="segment-route__transit-type">
                    <TransitTypeIcon type={r.transitType} size={11} /> {TRANSIT_TYPE_LABELS[r.transitType] ?? r.transitType}
                  </span>
                )}
                <span className="segment-route__meta">
                  {r.distance}
                  <span className="segment-route__time"><Clock size={9} />{r.duration}</span>
                </span>
              </>
            ) : (
              <span className="segment-route__meta">—</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function DayRoute({ locs }: { locs: LocationPoint[] }) {
  const [segmentModes, setSegmentModes] = useAtom(segmentModesAtom)
  const setDayRouteGeoJSON = useSetAtom(dayRouteGeoJSONAtom)
  const setSegmentSummary = useSetAtom(segmentSummaryAtom)
  const [allData, setAllData] = useState<Record<string, Record<TransportMode, SegResult>>>({})

  const pairs = useMemo(
    () => locs.slice(0, -1).map((loc, i) => ({ from: loc, to: locs[i + 1], key: `${loc.id}-${locs[i + 1].id}` })),
    [locs]
  )
  const coordsKey = useMemo(() => locs.map((l) => `${l.lat},${l.lng}`).join(';'), [locs])

  useEffect(() => {
    setSegmentModes((prev) => {
      const updates: Record<string, TransportMode> = {}
      for (const { from, to, key } of pairs) {
        if (!(key in prev)) {
          updates[key] = suggestMode(haversineDistance(from.lat, from.lng, to.lat, to.lng))
        }
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev
    })

    const init: Record<string, Record<TransportMode, SegResult>> = {}
    for (const { from, to, key } of pairs) {
      init[key] = {
        driving: 'loading', walking: 'loading', cycling: 'loading',
        transit: straightLineTransitResult(from, to),
        ferry: straightLineFerryResult(from, to),
        flight: straightLineFlightResult(from, to),
      }
    }
    setAllData(init)

    for (const { from, to, key } of pairs) {
      ;(['driving', 'walking', 'cycling'] as Array<Exclude<TransportMode, 'transit' | 'ferry' | 'flight'>>).forEach((m) => {
        fetchSegmentRoute(from, to, m, TOKEN).then((r) => {
          setAllData((prev) => ({ ...prev, [key]: { ...prev[key], [m]: r } }))
        })
      })
      fetchSegmentTransit(from, to).then((r) => {
        setAllData((prev) => ({ ...prev, [key]: { ...prev[key], transit: r } }))
      })
    }
  }, [coordsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const features: RouteGeoJSON['features'] = []
    const summaries: Record<string, { distance: string; duration: string }> = {}
    for (const { key } of pairs) {
      const mode = segmentModes[key] ?? 'walking'
      const data = allData[key]?.[mode]
      if (data && data !== 'loading') {
        if (data.geojson) features.push(...data.geojson.features)
        summaries[key] = { distance: data.distance, duration: data.duration }
      }
    }
    setDayRouteGeoJSON(features.length > 0 ? { type: 'FeatureCollection', features } : null)
    if (Object.keys(summaries).length > 0) {
      setSegmentSummary((prev) => ({ ...prev, ...summaries }))
    }
  }, [segmentModes, allData]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { setDayRouteGeoJSON(null) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    let totalDistKm = 0
    let totalDurSecs = 0
    for (const { key } of pairs) {
      const mode = segmentModes[key] ?? 'walking'
      const data = allData[key]?.[mode]
      if (!data || data === 'loading') return null
      totalDistKm += data.distKm
      totalDurSecs += data.durSecs
    }
    return { distance: formatDistance(totalDistKm), duration: fmtDuration(totalDurSecs) }
  }, [pairs, segmentModes, allData])

  return totals ? (
    <div className="day-route__total">
      <Navigation size={12} />
      {totals.distance} · {totals.duration} total
    </div>
  ) : null
}

interface SortableLocationListProps {
  locs: LocationPoint[]
  deletingLocationId: string | null
  reorderMode: boolean
  onFocus: (loc: LocationPoint) => void
  onDelete: (loc: LocationPoint) => void
}

function SortableLocationList({ locs, deletingLocationId, reorderMode, onFocus, onDelete }: SortableLocationListProps) {
  const router = useRouter()
  const [items, setItems] = useState<LocationPoint[]>(locs)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { setItems(locs) }, [locs])

  const segDists = useMemo(() => {
    const dists: number[] = []
    for (let i = 1; i < items.length; i++) {
      dists.push(haversineDistance(items[i - 1].lat, items[i - 1].lng, items[i].lat, items[i].lng))
    }
    return dists
  }, [items])

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((l) => l.id === active.id)
    const newIndex = items.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    const original = items

    setItems(reordered)
    setReorderError(null)

    try {
      const updates = reordered.map((loc, i) => ({ id: loc.id, orderIndex: i }))
      await reorderLocations(updates)
      router.refresh()
    } catch {
      setItems(original)
      setReorderError('Failed to save order — reverted.')
    }
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
        <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ol className="location-list">
            {items.map((loc, i) => (
              <SortableLocationItem
                key={loc.id}
                loc={loc}
                index={i + 1}
                prevLoc={i > 0 ? items[i - 1] : null}
                distFromPrev={i > 0 ? segDists[i - 1] : null}
                isDeleting={deletingLocationId === loc.id}
                reorderMode={reorderMode}
                onFocus={() => onFocus(loc)}
                onDelete={() => onDelete(loc)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {reorderError && <p className="location-list__error">{reorderError}</p>}
    </>
  )
}

interface SortableLocationItemProps {
  loc: LocationPoint
  index: number
  prevLoc: LocationPoint | null
  distFromPrev: number | null
  isDeleting: boolean
  reorderMode: boolean
  onFocus: () => void
  onDelete: () => void
}

function SortableLocationItem({ loc, index, prevLoc, distFromPrev, isDeleting, reorderMode, onFocus, onDelete }: SortableLocationItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: loc.id })
  const [notesOpen, setNotesOpen] = useState(false)
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [startingAddress, setStartingAddress] = useState('')
  const segmentModeValues = useAtomValue(segmentModesAtom)
  const segmentSummaries = useAtomValue(segmentSummaryAtom)

  const segKey = prevLoc ? `${prevLoc.id}-${loc.id}` : null
  const activeMode = segKey ? (segmentModeValues[segKey] ?? 'walking') : null
  const routeSummary = segKey ? (segmentSummaries[segKey] ?? null) : null

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={setNodeRef} style={style} className="location-list__item">
      <div className="location-list__row">
        {reorderMode ? (
          <span className="location-list__drag-handle" {...attributes} {...listeners} title="Drag to reorder">
            <GripVertical size={16} />
          </span>
        ) : (
          <span className="location-list__num">{index}</span>
        )}
        <div className="location-list__name-block">
          <button className="location-list__name" onClick={onFocus}>
            {loc.name}
          </button>
          {!notesOpen && (
            <button
              className={`location-list__notes-preview${loc.notes ? '' : ' location-list__notes-preview--empty'}`}
              onClick={() => setNotesOpen(true)}
            >
              {loc.notes ?? 'Add notes…'}
            </button>
          )}
        </div>
        <button
          className="location-list__delete"
          disabled={isDeleting}
          onClick={onDelete}
          title="Remove location"
        >
          <X size={13} />
        </button>
      </div>
      {notesOpen && (
        <LocationNotesEditor loc={loc} onClose={() => setNotesOpen(false)} />
      )}

      {prevLoc === null && (
        <div className="location-list__from">
          <MapPin size={12} className="location-list__from-icon" />
          <input
            className="location-list__from-input"
            placeholder="Starting from…"
            value={startingAddress}
            onChange={(e) => setStartingAddress(e.target.value)}
          />
        </div>
      )}

      {prevLoc !== null && distFromPrev !== null && activeMode && (
        <>
          <button
            className={`location-list__route-btn${segmentOpen ? ' location-list__route-btn--open' : ''}`}
            onClick={() => setSegmentOpen((o) => !o)}
          >
            <span className="location-list__route-icon"><ModeIcon mode={activeMode} size={13} /></span>
            <span className="location-list__route-info">
              {routeSummary ? (
                <>
                  {routeSummary.distance}
                  <span className="location-list__route-time"><Clock size={11} />{routeSummary.duration}</span>
                </>
              ) : (
                `≈ ${formatDistance(distFromPrev)}`
              )}
            </span>
            <span className="location-list__route-chevron">
              {segmentOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </span>
          </button>
          {segmentOpen && <SegmentRoutePanel from={prevLoc} to={loc} />}
        </>
      )}
    </li>
  )
}

function LocationNotesEditor({ loc, onClose }: { loc: LocationPoint; onClose: () => void }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateLocation, {})

  useEffect(() => {
    if (state.success) { router.refresh(); onClose() }
  }, [state.success]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form className="location-notes-editor" action={formAction}>
      <input type="hidden" name="id" value={loc.id} />
      <input type="hidden" name="name" value={loc.name} />
      <textarea
        className="location-notes-editor__textarea"
        name="notes"
        defaultValue={loc.notes ?? ''}
        placeholder="Add notes…"
        rows={2}
        autoFocus
      />
      {state.error && <p className="location-notes-editor__error">{state.error}</p>}
      <div className="location-notes-editor__actions">
        <button type="button" className="location-notes-editor__cancel" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={pending} className="location-notes-editor__submit">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
