'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  Plane, Clock, CircleCheck, Pencil,
  ChevronDown, ChevronUp, ArrowUpDown, Check, X,
  GripVertical, ArrowLeft, CalendarDays, Share2, MapPin, Navigation,
  MoreVertical, Trash2, Info, ArrowLeftRight, Tag,
} from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import 'react-day-picker/src/style.css'
import { selectedDayIdAtom, suggestedLocationAtom, focusedLocationAtom, focusedLocationIdAtom, segmentModesAtom, segmentSummaryAtom, dayRouteGeoJSONAtom, dayRouteTotalAtom } from '@/lib/store'
import { addDay } from '@/app/actions/addDay'
import { deleteLocation } from '@/app/actions/deleteLocation'
import { deleteDay } from '@/app/actions/deleteDay'
import { reorderLocations } from '@/app/actions/reorderLocations'
import { updateLocation } from '@/app/actions/updateLocation'
import { updateTrip } from '@/app/actions/updateTrip'
import { toggleLocationVisited } from '@/app/actions/toggleLocationVisited'
import { clearDayLocations } from '@/app/actions/clearDayLocations'
import { reorderDays } from '@/app/actions/reorderDays'
import { updateDayDate } from '@/app/actions/updateDayDate'
import { swapDayDates } from '@/app/actions/swapDayDates'
import { updateDaySummary } from '@/app/actions/updateDaySummary'
import { markAllLocationsVisited } from '@/app/actions/markAllLocationsVisited'
import { updateTripStyle } from '@/app/actions/updateTripStyle'
import { haversineDistance, formatDistance } from '@/lib/utils'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { TripWithDaysAndLocations, DayWithLocations, ActionState, SuggestedLocation, LocationPoint, TransportMode, RouteGeoJSON } from '@/types'

interface ConfirmState {
  title: string
  message: string
  onConfirm: () => void
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const TRIP_STYLES = [
  'First Time',
  'Classic',
  'Alternative',
  'Adventure',
  'Relaxed',
  'Cultural',
  'Culinary',
  'Family',
  'Historic',
] as const

const STYLE_CATEGORIES: Record<string, string[]> = {
  'First Time': ['tourist_attraction', 'viewpoint', 'museum', 'historic_site', 'landmark'],
  'Classic': ['museum', 'historic_site', 'art_gallery', 'viewpoint', 'tourist_attraction'],
  'Alternative': ['art_gallery', 'music_venue', 'cafe', 'bar', 'theater'],
  'Adventure': ['park', 'hiking_trail', 'nature_reserve', 'viewpoint', 'climbing_gym'],
  'Relaxed': ['park', 'cafe', 'spa', 'garden', 'viewpoint'],
  'Cultural': ['museum', 'art_gallery', 'historic_site', 'cultural_center', 'theater'],
  'Culinary': ['restaurant', 'food_market', 'cafe', 'bakery', 'bar'],
  'Family': ['zoo', 'amusement_park', 'park', 'museum', 'playground'],
  'Historic': ['historic_site', 'monument', 'castle', 'archaeological_site', 'landmark'],
}

const DEFAULT_CATEGORIES = ['tourist_attraction', 'historic_site', 'art_gallery', 'viewpoint', 'museum']

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


function sortDaysByDate(days: DayWithLocations[]): DayWithLocations[] {
  const withDates = [...days.filter((d) => d.date)].sort(
    (a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()
  )
  const withoutDates = days.filter((d) => !d.date)
  return [...withDates, ...withoutDates]
}

function DayProgressCircle({ visited, total }: { visited: number; total: number }) {
  if (total === 0) return null
  const r = 7.5
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - visited / total)
  return (
    <svg className="day-list__progress-circle" width="20" height="20" viewBox="0 0 20 20" aria-label={`${visited} of ${total} visited`}>
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" className="day-list__progress-bg" />
      {visited > 0 && (
        <circle
          cx="10" cy="10" r={r}
          fill="none" strokeWidth="2.5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
          className={`day-list__progress-fill${visited === total ? ' day-list__progress-fill--done' : ''}`}
        />
      )}
    </svg>
  )
}

interface TripDetailProps {
  trip: TripWithDaysAndLocations
  onBack: () => void
}

const initialState: ActionState = {}

async function geocodeDestination(destination: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json` +
        `?limit=1&types=place,locality,region,country&access_token=${TOKEN}`
    )
    if (!res.ok) return null
    const data = await res.json() as { features?: Array<{ center: [number, number] }> }
    const feature = data.features?.[0]
    if (!feature) return null
    return { lng: feature.center[0], lat: feature.center[1] }
  } catch {
    return null
  }
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function hasNonAscii(str: string): boolean {
  return /[^\x00-\x7F]/.test(str)
}

async function fetchNearbySuggestions(lat: number, lng: number, exclude: string[], tripStyles: string[] = []): Promise<SuggestedLocation[]> {
  const styleCategories = tripStyles.flatMap((s) => STYLE_CATEGORIES[s] ?? [])
  const categories = styleCategories.length > 0
    ? [...new Set(styleCategories)].slice(0, 5)
    : DEFAULT_CATEGORIES

  const results = await Promise.all(
    categories.map(async (category): Promise<SuggestedLocation | null> => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/category/${category}` +
            `?proximity=${lng},${lat}&limit=3&access_token=${TOKEN}`
        )
        if (!res.ok) return null
        const data = await res.json()
        const features = (data.features ?? []) as Array<{
          properties: { name: string; categories?: string[]; poi_category?: string[] }
          geometry: { coordinates: [number, number] }
        }>
        const pick = features.find(f => !exclude.includes(f.properties.name))
        if (!pick) return null
        return {
          name: pick.properties.name,
          lng: pick.geometry.coordinates[0],
          lat: pick.geometry.coordinates[1],
          category,
          poiCategories: pick.properties.categories ?? pick.properties.poi_category ?? [],
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
  const setFocusedLocationId = useSetAtom(focusedLocationIdAtom)
  const dayRouteTotal = useAtomValue(dayRouteTotalAtom)
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
  const [dayItems, setDayItems] = useState<DayWithLocations[]>(sortDaysByDate([...trip.days]))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [menuOpenDayId, setMenuOpenDayId] = useState<string | null>(null)
  const [dayDatePickerId, setDayDatePickerId] = useState<string | null>(null)
  const [switchDaysMode, setSwitchDaysMode] = useState(false)
  const [switchFirstDayId, setSwitchFirstDayId] = useState<string | null>(null)
  const [switchSecondDayId, setSwitchSecondDayId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [editingSummaryDayId, setEditingSummaryDayId] = useState<string | null>(null)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [tripStyles, setTripStyles] = useState<string[]>(trip.tripStyle ?? [])
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false)

  useEffect(() => {
    if (!menuOpenDayId) return
    function handleOutsideClick() { setMenuOpenDayId(null) }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [menuOpenDayId])

  useEffect(() => {
    if (!dayDatePickerId) return
    function handleOutsideClick() { setDayDatePickerId(null) }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [dayDatePickerId])


  useEffect(() => {
    const sorted = sortDaysByDate([...trip.days])
    setDayItems(sorted)
    const needsReorder = sorted.some((d, i) => d.dayNumber !== i + 1)
    if (needsReorder) void reorderDays(sorted.map((d, i) => ({ id: d.id, dayNumber: i + 1 })))
  }, [trip.days])

  async function handleDayDateSelect(dayId: string, date: Date | undefined): Promise<void> {
    const newDate = date ?? null
    const updated = dayItems.map((d) => d.id === dayId ? { ...d, date: newDate } : d)
    const sorted = sortDaysByDate(updated)
    const original = dayItems
    setDayItems(sorted)
    setDayDatePickerId(null)
    try {
      await updateDayDate(dayId, newDate)
      const orderChanged = sorted.some((d, i) => d.id !== original[i]?.id)
      if (orderChanged) await reorderDays(sorted.map((d, i) => ({ id: d.id, dayNumber: i + 1 })))
      router.refresh()
    } catch {
      setDayItems(original)
    }
  }

  function handleSwitchDayClick(dayId: string): void {
    // Toggle deselect
    if (switchFirstDayId === dayId) { setSwitchFirstDayId(switchSecondDayId); setSwitchSecondDayId(null); return }
    if (switchSecondDayId === dayId) { setSwitchSecondDayId(null); return }
    // Select
    if (!switchFirstDayId) { setSwitchFirstDayId(dayId); return }
    setSwitchSecondDayId(dayId)
  }

  function showToast(msg: string): void {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  async function handleSaveSummary(dayId: string): Promise<void> {
    const original = dayItems
    setDayItems(dayItems.map((d) => d.id === dayId ? { ...d, summary: summaryDraft.trim() || null } : d))
    setEditingSummaryDayId(null)
    try {
      await updateDaySummary(dayId, summaryDraft)
      router.refresh()
    } catch {
      setDayItems(original)
    }
  }

  async function handleMarkAllVisited(dayId: string, visited: boolean): Promise<void> {
    const original = dayItems
    setDayItems(dayItems.map((d) =>
      d.id !== dayId ? d : { ...d, locations: d.locations.map((l) => ({ ...l, visited })) }
    ))
    setMenuOpenDayId(null)
    try {
      await markAllLocationsVisited(dayId, visited)
      router.refresh()
    } catch {
      setDayItems(original)
    }
  }

  async function confirmSwap(): Promise<void> {
    if (!switchFirstDayId || !switchSecondDayId) return
    const aIdx = dayItems.findIndex((d) => d.id === switchFirstDayId)
    const bIdx = dayItems.findIndex((d) => d.id === switchSecondDayId)
    const dayA = dayItems[aIdx]
    const dayB = dayItems[bIdx]
    const original = dayItems

    const swapped = dayItems.map((d) => {
      if (d.id === switchFirstDayId) return { ...d, date: dayB.date }
      if (d.id === switchSecondDayId) return { ...d, date: dayA.date }
      return d
    })
    const toSort = (!dayA.date && !dayB.date)
      ? swapped.map((_, i) => {
          if (i === aIdx) return swapped[bIdx]
          if (i === bIdx) return swapped[aIdx]
          return swapped[i]
        })
      : swapped

    setDayItems(sortDaysByDate(toSort))
    setSwitchFirstDayId(null)
    setSwitchSecondDayId(null)
    setSwitchDaysMode(false)

    try {
      await swapDayDates(switchFirstDayId, switchSecondDayId)
      showToast('Days switched')
      router.refresh()
    } catch {
      setDayItems(original)
    }
  }

  async function handleShare(): Promise<void> {
    const url = `${window.location.origin}/share/${trip.shareToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDayClick(dayId: string): void {
    const nextId = dayId === selectedDayId ? null : dayId
    setSelectedDayId(nextId)
    setFocusedLocationId(null)
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

  async function handleSuggest(dayId: string, lat: number | null, lng: number | null): Promise<void> {
    setSuggestingForDayId(dayId)
    setSuggestLoading(true)
    setSuggestions([])

    let resolvedLat = lat
    let resolvedLng = lng
    if (resolvedLat === null || resolvedLng === null) {
      const coords = await geocodeDestination(trip.destination)
      if (!coords) { setSuggestLoading(false); return }
      resolvedLat = coords.lat
      resolvedLng = coords.lng
    }

    const allVisited = dayItems.flatMap((d) => d.locations.map((l) => l.name))
    const exclude = [...new Set([...(seenNames[dayId] ?? []), ...allVisited])]
    const results = await fetchNearbySuggestions(resolvedLat, resolvedLng, exclude, tripStyles)
    setSeenNames((prev) => ({
      ...prev,
      [dayId]: [...(prev[dayId] ?? []), ...results.map((r) => r.name)],
    }))
    setSuggestions(results)
    setSuggestLoading(false)

    // Fetch English names for non-ASCII names in parallel (non-blocking)
    const nonAscii = results.filter((r) => hasNonAscii(r.name))
    if (nonAscii.length > 0) {
      Promise.all(
        nonAscii.map(async (r) => {
          try {
            const res = await fetch(`/api/place-name?name=${encodeURIComponent(r.name)}&city=${encodeURIComponent(trip.destination)}`)
            const data = await res.json() as { name: string | null; type: string | null }
            const en = data.name?.trim() ?? null
            if (en && en.toLowerCase() !== r.name.toLowerCase()) {
              return { name: r.name, englishName: en }
            }
          } catch { /* ignore */ }
          return null
        })
      ).then((updates) => {
        const map = new Map(updates.filter((u): u is { name: string; englishName: string } => u !== null).map((u) => [u.name, u.englishName]))
        if (map.size > 0) {
          setSuggestions((prev) => prev.map((s) => map.has(s.name) ? { ...s, englishName: map.get(s.name) } : s))
        }
      })
    }
  }

  function handleSuggestionClick(loc: SuggestedLocation): void {
    setSuggestedLocation(loc)
    setSuggestions([])
    setSuggestingForDayId(null)
  }

  function handleToggleStyle(style: string): void {
    const next = tripStyles.includes(style)
      ? tripStyles.filter((s) => s !== style)
      : [...tripStyles, style]
    setTripStyles(next)
    void updateTripStyle(trip.id, next)
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

  function handleClearDayLocations(dayId: string, dayNumber: number, locationCount: number): void {
    setConfirmModal({
      title: `Clear Day ${dayNumber} locations?`,
      message: `All ${locationCount} location${locationCount !== 1 ? 's' : ''} will be removed. The day itself will remain.`,
      onConfirm: async () => {
        setConfirmModal(null)
        await clearDayLocations(dayId)
        router.refresh()
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
            <div className="trip-detail__style-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                className={`trip-detail__date-btn${styleDropdownOpen ? ' trip-detail__date-btn--open' : ''}${tripStyles.length > 0 ? ' trip-detail__date-btn--set' : ''}`}
                onClick={() => setStyleDropdownOpen((o) => !o)}
                title="Set trip style"
              >
                <Tag size={13} />
                <span>Trip style</span>
                <ChevronDown size={11} />
              </button>
              {styleDropdownOpen && (
                <div className="trip-detail__style-dropdown">
                  {TRIP_STYLES.map((style) => (
                    <button
                      key={style}
                      className={`trip-detail__style-option${tripStyles.includes(style) ? ' trip-detail__style-option--active' : ''}`}
                      onClick={() => handleToggleStyle(style)}
                    >
                      {tripStyles.includes(style) && <Check size={11} />}
                      {style}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
        {(dayItems.length > 0 || tripStyles.length > 0) && (
          <div className="trip-detail__trip-stats">
            {dayItems.length > 0 && (
              <span>{dayItems.length} {dayItems.length === 1 ? 'day' : 'days'} · {dayItems.reduce((sum, d) => sum + d.locations.length, 0)} locations</span>
            )}
            {tripStyles.map((style) => (
              <span key={style} className="trip-detail__style-chip">· {style}</span>
            ))}
          </div>
        )}

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
        <div className="trip-detail__days-header">
          <h3 className="trip-detail__days-heading">Days</h3>
          {dayItems.length >= 2 && switchDaysMode && switchFirstDayId && switchSecondDayId ? (
            <button
              className="trip-detail__reorder-days-btn trip-detail__reorder-days-btn--confirm"
              onClick={() => void confirmSwap()}
            >
              <Check size={13} />
              Confirm swap
            </button>
          ) : dayItems.length >= 2 ? (
            <button
              className={`trip-detail__reorder-days-btn${switchDaysMode ? ' trip-detail__reorder-days-btn--active' : ''}`}
              onClick={() => { setSwitchDaysMode((m) => !m); setSwitchFirstDayId(null); setSwitchSecondDayId(null) }}
            >
              <ArrowLeftRight size={13} />
              {switchDaysMode ? 'Cancel' : 'Switch days'}
            </button>
          ) : null}
        </div>
        {dayItems.length === 0 ? (
          <div className="trip-detail__empty">
            <p>No days yet.</p>
            <p className="trip-detail__empty-hint">Add your first day below, then click the map to drop location pins.</p>
          </div>
        ) : (
          <ul className="day-list">
            {dayItems.map((day, dayIdx) => {
              const isOpen = day.id === selectedDayId
              const locs = [...day.locations].sort((a, b) => a.orderIndex - b.orderIndex)
              const customDate = day.date ? new Date(day.date) : null

              let totalDist = 0
              for (let i = 1; i < locs.length; i++) {
                totalDist += haversineDistance(locs[i - 1].lat, locs[i - 1].lng, locs[i].lat, locs[i].lng)
              }

              const lastLoc = locs[locs.length - 1]
              const difficulty = computeDayDifficulty(locs, segmentModes)
              const displayNumber = dayIdx + 1
              const displayDate = customDate
                ? customDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : null

              return (
                <li key={day.id} className={`day-list__item day-list__item--color-${dayIdx % 10}${isOpen ? ' day-list__item--active' : ''}`}>
                  <div className="day-list__header-row">
                    {switchDaysMode && (
                      <button
                        className={`day-list__num-badge${switchFirstDayId === day.id || switchSecondDayId === day.id ? ' day-list__num-badge--selected' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleSwitchDayClick(day.id) }}
                      >
                        {displayNumber}
                      </button>
                    )}
                    <button className="day-list__header" onClick={() => handleDayClick(day.id)}>
                      <span className="day-list__chevron">
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                      <span className="day-list__number-col">
                        <span className="day-list__number">
                          Day {displayNumber}
                          <span className="day-list__color-dot" />
                        </span>
                        {displayDate && <span className={`day-list__date${customDate ? ' day-list__date--custom' : ''}`}>{displayDate}</span>}
                      </span>
                      <span className="day-list__meta">
                        <span className="day-list__count">
                          {locs.length} loc{locs.length !== 1 ? 's' : ''}
                        </span>
                        {locs.length > 1 && (
                          <span className="day-list__total-dist">
                            {isOpen && dayRouteTotal ? dayRouteTotal : formatDistance(totalDist)}
                          </span>
                        )}
                        {difficulty && (
                          <span className={`day-list__difficulty day-list__difficulty--${difficulty}`}>
                            {difficulty}
                          </span>
                        )}
                        {locs.length > 0 && (
                          <DayProgressCircle
                            visited={locs.filter((l) => l.visited).length}
                            total={locs.length}
                          />
                        )}
                      </span>
                    </button>
                    {!switchDaysMode && (
                      <button
                        className={`day-list__cal-btn${customDate ? ' day-list__cal-btn--set' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setDayDatePickerId(dayDatePickerId === day.id ? null : day.id); setMenuOpenDayId(null) }}
                        title={customDate ? 'Change date' : 'Set date'}
                      >
                        <CalendarDays size={14} />
                      </button>
                    )}
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
                          {locs.length > 0 && !locs.every((l) => l.visited) && (
                            <button
                              className="day-list__menu-item"
                              onClick={(e) => { e.stopPropagation(); void handleMarkAllVisited(day.id, true) }}
                            >
                              <CircleCheck size={13} />
                              Mark all done
                            </button>
                          )}
                          {locs.length > 0 && locs.every((l) => l.visited) && (
                            <button
                              className="day-list__menu-item"
                              onClick={(e) => { e.stopPropagation(); void handleMarkAllVisited(day.id, false) }}
                            >
                              <CircleCheck size={13} />
                              Unmark all
                            </button>
                          )}
                          {locs.length > 0 && (
                            <button
                              className="day-list__menu-item"
                              onClick={(e) => { e.stopPropagation(); setMenuOpenDayId(null); handleClearDayLocations(day.id, day.dayNumber, locs.length) }}
                            >
                              <X size={13} />
                              Clear locations
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

                  {dayDatePickerId === day.id && (
                    <div className="day-list__day-picker-wrap" onClick={(e) => e.stopPropagation()}>
                      <DayPicker
                        mode="single"
                        selected={customDate ?? undefined}
                        onSelect={(date) => void handleDayDateSelect(day.id, date)}
                        disabled={[
                          ...dayItems.filter((d) => d.id !== day.id && d.date).map((d) => new Date(d.date!)),
                          ...(startDate ? [{ before: startDate }] : []),
                          ...(endDate ? [{ after: endDate }] : []),
                        ]}
                        defaultMonth={customDate ?? startDate ?? undefined}
                      />
                      {customDate && (
                        <button className="day-list__day-picker-clear" onClick={() => void handleDayDateSelect(day.id, undefined)}>
                          Clear date
                        </button>
                      )}
                    </div>
                  )}

                  {isOpen && (
                    <div className="day-list__body">
                      {editingSummaryDayId === day.id ? (
                        <div className="day-summary-editor">
                          <textarea
                            className="day-summary-editor__textarea"
                            value={summaryDraft}
                            onChange={(e) => setSummaryDraft(e.target.value)}
                            placeholder="Add a description for this day…"
                            rows={3}
                            autoFocus
                          />
                          <div className="day-summary-editor__actions">
                            <button className="day-summary-editor__cancel" onClick={() => setEditingSummaryDayId(null)}>Cancel</button>
                            <button className="day-summary-editor__save" onClick={() => void handleSaveSummary(day.id)}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <div className="day-list__summary-row">
                          {day.summary && <p className="day-list__summary">{day.summary}</p>}
                          <button
                            className="day-list__summary-edit-btn"
                            onClick={() => { setSummaryDraft(day.summary ?? ''); setEditingSummaryDayId(day.id) }}
                          >
                            <Pencil size={11} />
                            {day.summary ? 'Edit description' : 'Add description'}
                          </button>
                        </div>
                      )}

                      {locs.length === 0 ? (
                        <p className="day-list__hint">Click anywhere on the map to add your first location</p>
                      ) : (
                        <SortableLocationList
                          locs={locs}
                          city={trip.destination}
                          deletingLocationId={deletingLocationId}
                          reorderMode={reorderMode}
                          tripStyles={tripStyles}
                          onFocus={(loc) => setFocusedLocation({ lat: loc.lat, lng: loc.lng })}
                          onDelete={(loc) => handleDeleteLocation(loc.id, loc.name)}
                        />
                      )}

                      {locs.length >= 2 && <DayRoute locs={locs} />}

                      <div className="day-list__suggest">
                        <button
                          className="day-list__suggest-btn"
                          onClick={() => handleSuggest(day.id, lastLoc?.lat ?? null, lastLoc?.lng ?? null)}
                          disabled={suggestLoading && suggestingForDayId === day.id}
                        >
                          {suggestLoading && suggestingForDayId === day.id ? 'Loading…' : locs.length === 0 ? '+ Suggest first location' : '+ Suggest next location'}
                        </button>
                        {suggestingForDayId === day.id && suggestions.length > 0 && (
                          <ul className="suggest-list">
                            {suggestions.map((s) => {
                              const matchingStyles = tripStyles.filter((style) =>
                                (STYLE_CATEGORIES[style] ?? []).includes(s.category)
                              )
                              return (
                                <li key={`${s.lat}-${s.lng}`} className="suggest-list__item">
                                  <button
                                    className="suggest-list__btn"
                                    onClick={() => handleSuggestionClick(s)}
                                  >
                                    <span className="suggest-list__name">
                                      {s.name}
                                      {s.englishName && (
                                        <span className="suggest-list__english">{s.englishName}</span>
                                      )}
                                    </span>
                                    <span className="suggest-list__meta">
                                      <span className="suggest-list__type">{formatCategory(s.category)}</span>
                                      {matchingStyles.map((style) => (
                                        <span key={style} className="suggest-list__style-tag">{style}</span>
                                      ))}
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>

                      {locs.length > 0 && <p className="day-list__hint">Click the map to add another location</p>}
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
        {state.error && <p className="add-day-form__error">{state.error}</p>}
        <button type="submit" disabled={pending} className="add-day-form__submit">
          {pending ? 'Adding…' : '+ Add Day'}
        </button>
      </form>

      {toast && (
        <div className="trip-toast" role="status">
          <Check size={14} />
          {toast}
        </div>
      )}
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
  const setDayRouteTotal = useSetAtom(dayRouteTotalAtom)
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
    return () => { setDayRouteGeoJSON(null); setDayRouteTotal(null) }
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

  useEffect(() => {
    setDayRouteTotal(totals?.distance ?? null)
  }, [totals]) // eslint-disable-line react-hooks/exhaustive-deps

  return totals ? (
    <div className="day-route__total">
      <Navigation size={12} />
      {totals.distance} · {totals.duration} total
    </div>
  ) : null
}


interface SortableLocationListProps {
  locs: LocationPoint[]
  city: string
  deletingLocationId: string | null
  reorderMode: boolean
  tripStyles: string[]
  onFocus: (loc: LocationPoint) => void
  onDelete: (loc: LocationPoint) => void
}

function SortableLocationList({ locs, city, deletingLocationId, reorderMode, tripStyles, onFocus, onDelete }: SortableLocationListProps) {
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
                city={city}
                index={i + 1}
                prevLoc={i > 0 ? items[i - 1] : null}
                distFromPrev={i > 0 ? segDists[i - 1] : null}
                isDeleting={deletingLocationId === loc.id}
                reorderMode={reorderMode}
                tripStyles={tripStyles}
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

type PlaceInfo = {
  google: {
    openNow: boolean | null
    todayHours: string | null
    weekdayDescriptions: string[] | null
    rating: number | null
    priceLevel: string | null
    website: string | null
  } | null
  ai: {
    summary: string
    type?: string
    duration?: string
    tip?: string
  } | null
}

const placeInfoCache = new Map<string, PlaceInfo>()

interface SortableLocationItemProps {
  loc: LocationPoint
  city: string
  index: number
  prevLoc: LocationPoint | null
  distFromPrev: number | null
  isDeleting: boolean
  reorderMode: boolean
  tripStyles: string[]
  onFocus: () => void
  onDelete: () => void
}

function matchingTripStyles(type: string | null, styles: string[]): string[] {
  if (!type || styles.length === 0) return []
  const normalized = type.toLowerCase().replace(/[_\s]+/g, ' ').trim()
  return styles.filter((style) =>
    (STYLE_CATEGORIES[style] ?? []).some((cat) => {
      const catNorm = cat.replace(/_/g, ' ')
      return catNorm === normalized || catNorm.includes(normalized) || normalized.includes(catNorm)
    })
  )
}

function SortableLocationItem({ loc, city, index, prevLoc, distFromPrev, isDeleting, reorderMode, tripStyles, onFocus, onDelete }: SortableLocationItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: loc.id })
  const router = useRouter()
  const [notesOpen, setNotesOpen] = useState(false)
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [startingAddress, setStartingAddress] = useState('')
  const [visited, setVisited] = useState(loc.visited)
  useEffect(() => { setVisited(loc.visited) }, [loc.visited])
  const infoCacheKey = `${loc.name}|${city}|${loc.lat}|${loc.lng}`
  const nameCacheKey = `${loc.name}|${city}`
  const [durationHint, setDurationHint] = useState<string | null>(() => placeInfoCache.get(infoCacheKey)?.ai?.duration ?? null)
  const [locationType, setLocationType] = useState<string | null>(() => englishNameCache.get(nameCacheKey)?.type ?? null)
  const segmentModeValues = useAtomValue(segmentModesAtom)
  const segmentSummaries = useAtomValue(segmentSummaryAtom)
  const [focusedLocationId, setFocusedLocationId] = useAtom(focusedLocationIdAtom)
  const isFocused = focusedLocationId === loc.id
  const itemRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    if (isFocused) itemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isFocused])

  const segKey = prevLoc ? `${prevLoc.id}-${loc.id}` : null
  const activeMode = segKey ? (segmentModeValues[segKey] ?? 'walking') : null
  const routeSummary = segKey ? (segmentSummaries[segKey] ?? null) : null

  async function handleToggleVisited() {
    const next = !visited
    setVisited(next)
    try {
      await toggleLocationVisited(loc.id, next)
      router.refresh()
    } catch {
      setVisited(!next)
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={(el) => { setNodeRef(el); itemRef.current = el }} style={style} className="location-list__item">
      <div className="location-list__row">
        {reorderMode ? (
          <span className="location-list__drag-handle" {...attributes} {...listeners} title="Drag to reorder">
            <GripVertical size={16} />
          </span>
        ) : (
          <span
            className={`location-list__num${isFocused ? ' location-list__num--focused' : visited ? ' location-list__num--visited' : ''}`}
            onClick={() => { setFocusedLocationId(loc.id); onFocus() }}
            role="button"
            tabIndex={0}
          >{index}</span>
        )}
        <div className="location-list__name-block">
          <div className="location-list__name-row">
            <button className="location-list__name" onClick={() => { setFocusedLocationId(loc.id); onFocus() }}>
              {loc.name}
            </button>
            <EnglishNameBadge name={loc.name} city={city} onTypeLoaded={setLocationType} />
            {locationType && <span className="location-list__type-badge">{locationType}</span>}
            {matchingTripStyles(locationType, tripStyles).map((style) => (
              <span key={style} className="location-list__style-tag">{style}</span>
            ))}
          </div>
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
          className={`location-list__visited${visited ? ' location-list__visited--done' : ''}`}
          onClick={() => void handleToggleVisited()}
          title={visited ? 'Mark as not visited' : 'Mark as visited'}
        >
          <CircleCheck size={15} />
        </button>
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
        <div className="location-list__nav-row location-list__nav-row--from">
          <div className="location-list__from">
            <MapPin size={12} className="location-list__from-icon" />
            <input
              className="location-list__from-input"
              placeholder="Starting from…"
              value={startingAddress}
              onChange={(e) => setStartingAddress(e.target.value)}
            />
          </div>
          {durationHint && (
            <span className="location-list__duration-hint">
              <Clock size={10} />{durationHint}
            </span>
          )}
          <button
            className={`location-list__info-circle${infoOpen ? ' location-list__info-circle--active' : ''}`}
            onClick={() => setInfoOpen((o) => !o)}
            title="Place info"
          >
            <Info size={12} />
          </button>
        </div>
      )}

      {prevLoc !== null && distFromPrev !== null && activeMode && (
        <>
          <div className="location-list__nav-row">
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
            {durationHint && (
              <span className="location-list__duration-hint">
                <Clock size={10} />{durationHint}
              </span>
            )}
            <button
              className={`location-list__info-circle${infoOpen ? ' location-list__info-circle--active' : ''}`}
              onClick={() => setInfoOpen((o) => !o)}
              title="Place info"
            >
              <Info size={12} />
            </button>
          </div>
          {segmentOpen && <SegmentRoutePanel from={prevLoc} to={loc} />}
        </>
      )}
      {infoOpen && (
        <LocationInfoPanel
          name={loc.name} city={city} lat={loc.lat} lng={loc.lng}
          onDurationLoaded={(d) => { if (d) setDurationHint(d) }}
        />
      )}
    </li>
  )
}


interface PlaceNameData { name: string | null; type: string | null }
const englishNameCache = new Map<string, PlaceNameData>()

function EnglishNameBadge({ name, city, onTypeLoaded }: { name: string; city: string; onTypeLoaded?: (type: string | null) => void }) {
  const cacheKey = `${name}|${city}`
  const cached = englishNameCache.get(cacheKey)
  const [englishName, setEnglishName] = useState<string | null>(cached?.name ?? null)

  useEffect(() => {
    if (cached !== undefined) {
      onTypeLoaded?.(cached.type)
      return
    }
    const params = new URLSearchParams({ name, city })
    fetch(`/api/place-name?${params}`)
      .then((r) => r.json())
      .then((data: PlaceNameData) => {
        englishNameCache.set(cacheKey, data)
        setEnglishName(data.name)
        onTypeLoaded?.(data.type)
      })
      .catch(() => englishNameCache.set(cacheKey, { name: null, type: null }))
  }, [cacheKey, cached, name, city, onTypeLoaded])

  if (!englishName || englishName.toLowerCase() === name.toLowerCase()) return null
  return <span className="location-list__english-name">{englishName}</span>
}

function priceLevelLabel(level: string): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  }
  return map[level] ?? ''
}

function LocationInfoPanel({ name, city, lat, lng, onDurationLoaded }: {
  name: string; city: string; lat: number; lng: number
  onDurationLoaded?: (duration: string | null) => void
}) {
  const cacheKey = `${name}|${city}|${lat}|${lng}`
  const cached = placeInfoCache.get(cacheKey)
  const [info, setInfo] = useState<PlaceInfo | 'loading'>(cached ?? 'loading')
  const [hoursOpen, setHoursOpen] = useState(false)

  useEffect(() => {
    if (cached?.ai) {
      onDurationLoaded?.(cached.ai.duration ?? null)
      return
    }
    const params = new URLSearchParams({ name, city, lat: String(lat), lng: String(lng) })
    fetch(`/api/place-info?${params}`)
      .then((r) => r.json())
      .then((data: PlaceInfo) => {
        if (data.ai) {
          placeInfoCache.set(cacheKey, data)
          onDurationLoaded?.(data.ai.duration ?? null)
        }
        setInfo(data)
      })
      .catch(() => setInfo({ google: null, ai: null }))
  }, [cacheKey, cached, name, lat, lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const g = info !== 'loading' ? info.google : null
  const ai = info !== 'loading' ? info.ai : null

  return (
    <div className="location-info">
      {info === 'loading' ? (
        <p className="location-info__loading">Loading…</p>
      ) : (
        <>
          {ai && (
            <>
              {(ai.type || ai.duration) && (
                <div className="location-info__ai-badges">
                  {ai.type && <span className="location-info__ai-badge">{ai.type}</span>}
                  {ai.duration && (
                    <span className="location-info__ai-badge location-info__ai-badge--duration">
                      <Clock size={10} /> {ai.duration}
                    </span>
                  )}
                </div>
              )}
              <p className="location-info__summary">{ai.summary}</p>
              {ai.tip && <p className="location-info__tip">💡 {ai.tip}</p>}
            </>
          )}

          {g && (
            <div className="location-info__practical">
              <div className="location-info__meta-top">
                {g.openNow !== null && (
                  <span className={`location-info__open-badge${g.openNow ? '' : ' location-info__open-badge--closed'}`}>
                    {g.openNow ? 'Open now' : 'Closed'}
                  </span>
                )}
                {g.rating !== null && (
                  <span className="location-info__rating">★ {g.rating.toFixed(1)}</span>
                )}
                {g.priceLevel && (
                  <span className="location-info__price">{priceLevelLabel(g.priceLevel)}</span>
                )}
              </div>

              {g.todayHours && (
                <div className="location-info__hours-row">
                  <Clock size={11} className="location-info__meta-icon" />
                  <span className="location-info__hours-today">{g.todayHours}</span>
                  {g.weekdayDescriptions && g.weekdayDescriptions.length > 1 && (
                    <button className="location-info__hours-toggle" onClick={() => setHoursOpen((o) => !o)}>
                      {hoursOpen ? '▲' : '▼'}
                    </button>
                  )}
                </div>
              )}

              {hoursOpen && g.weekdayDescriptions && (
                <ul className="location-info__hours-list">
                  {g.weekdayDescriptions.map((line) => (
                    <li key={line} className="location-info__hours-item">{line}</li>
                  ))}
                </ul>
              )}

              {g.website && (
                <a
                  className="location-info__ext-link"
                  href={g.website.startsWith('http') ? g.website : `https://${g.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official website ↗
                </a>
              )}
            </div>
          )}

          <div className="location-info__actions">
            <a
              className="location-info__action-link"
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={11} />
              Google Maps
            </a>
          </div>
        </>
      )}
    </div>
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
