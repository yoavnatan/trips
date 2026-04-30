'use client'

import { useState, useEffect, useMemo } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useAtom, useSetAtom } from 'jotai'
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
import { selectedDayIdAtom, suggestedLocationAtom, focusedLocationAtom } from '@/lib/store'
import { addDay } from '@/app/actions/addDay'
import { deleteLocation } from '@/app/actions/deleteLocation'
import { deleteDay } from '@/app/actions/deleteDay'
import { reorderLocations } from '@/app/actions/reorderLocations'
import { updateLocation } from '@/app/actions/updateLocation'
import { haversineDistance, formatDistance } from '@/lib/utils'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { TripWithDaysAndLocations, ActionState, SuggestedLocation, LocationPoint } from '@/types'

interface ConfirmState {
  title: string
  message: string
  onConfirm: () => void
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

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
  const setSuggestedLocation = useSetAtom(suggestedLocationAtom)
  const setFocusedLocation = useSetAtom(focusedLocationAtom)
  const [suggestions, setSuggestions] = useState<SuggestedLocation[]>([])
  const [suggestingForDayId, setSuggestingForDayId] = useState<string | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [seenNames, setSeenNames] = useState<Record<string, string[]>>({})
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null)
  const [deletingDayId, setDeletingDayId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null)

  function handleDayClick(dayId: string): void {
    const nextId = dayId === selectedDayId ? null : dayId
    setSelectedDayId(nextId)
    setSuggestions([])
    setSuggestingForDayId(null)
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

  return (
    <div className="trip-detail">
      <button className="trip-detail__back" onClick={onBack}>
        ← Back
      </button>

      <div className="trip-detail__header">
        <h2 className="trip-detail__title">{trip.title}</h2>
        <p className="trip-detail__destination">{trip.destination}</p>
      </div>

      <div className="trip-detail__days">
        <h3 className="trip-detail__days-heading">Days</h3>
        {trip.days.length === 0 ? (
          <p className="trip-detail__empty">No days yet — add one below.</p>
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

              return (
                <li key={day.id} className={`day-list__item${isOpen ? ' day-list__item--active' : ''}`}>
                  <div className="day-list__header-row">
                    <button className="day-list__header" onClick={() => handleDayClick(day.id)}>
                      <span className="day-list__number">Day {day.dayNumber}</span>
                      <span className="day-list__meta">
                        <span className="day-list__count">
                          {locs.length} loc{locs.length !== 1 ? 's' : ''}
                        </span>
                        {locs.length > 1 && (
                          <span className="day-list__total-dist">{formatDistance(totalDist)}</span>
                        )}
                      </span>
                      <span className="day-list__chevron">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    <button
                      className="day-list__delete-day"
                      disabled={deletingDayId === day.id}
                      onClick={(e) => { e.stopPropagation(); handleDeleteDay(day.id, day.dayNumber, locs.length) }}
                      title="Delete day"
                    >
                      ×
                    </button>
                  </div>

                  {isOpen && (
                    <div className="day-list__body">
                      {day.summary && <p className="day-list__summary">{day.summary}</p>}

                      {locs.length === 0 ? (
                        <p className="day-list__hint">Click the map to add locations</p>
                      ) : (
                        <SortableLocationList
                          locs={locs}
                          deletingLocationId={deletingLocationId}
                          onFocus={(loc) => setFocusedLocation({ lat: loc.lat, lng: loc.lng })}
                          onDelete={(loc) => handleDeleteLocation(loc.id, loc.name)}
                        />
                      )}

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

                      <p className="day-list__hint">Click the map to add a location</p>
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

interface SortableLocationListProps {
  locs: LocationPoint[]
  deletingLocationId: string | null
  onFocus: (loc: LocationPoint) => void
  onDelete: (loc: LocationPoint) => void
}

function SortableLocationList({ locs, deletingLocationId, onFocus, onDelete }: SortableLocationListProps) {
  const router = useRouter()
  const [items, setItems] = useState<LocationPoint[]>(locs)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Sync with server data after refresh
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

    // Optimistic update — move immediately
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
                distToNext={i < items.length - 1 ? segDists[i] : null}
                isDeleting={deletingLocationId === loc.id}
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
  distToNext: number | null
  isDeleting: boolean
  onFocus: () => void
  onDelete: () => void
}

function SortableLocationItem({ loc, distToNext, isDeleting, onFocus, onDelete }: SortableLocationItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: loc.id })
  const [notesOpen, setNotesOpen] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={setNodeRef} style={style} className="location-list__item">
      <div className="location-list__row">
        <span className="location-list__drag-handle" {...attributes} {...listeners} title="Drag to reorder">
          ⠿
        </span>
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
          ×
        </button>
      </div>
      {notesOpen && (
        <LocationNotesEditor loc={loc} onClose={() => setNotesOpen(false)} />
      )}
      {distToNext !== null && (
        <span className="location-list__dist">↓ {formatDistance(distToNext)}</span>
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
