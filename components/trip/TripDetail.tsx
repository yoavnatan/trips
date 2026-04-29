'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { selectedDayIdAtom, suggestedLocationAtom } from '@/lib/store'
import { addDay } from '@/app/actions/addDay'
import { haversineDistance, formatDistance } from '@/lib/utils'
import type { TripWithDaysAndLocations, ActionState, SuggestedLocation } from '@/types'

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
  const [state, formAction, pending] = useActionState(addDay, initialState)
  const [selectedDayId, setSelectedDayId] = useAtom(selectedDayIdAtom)
  const setSuggestedLocation = useSetAtom(suggestedLocationAtom)
  const [suggestions, setSuggestions] = useState<SuggestedLocation[]>([])
  const [suggestingForDayId, setSuggestingForDayId] = useState<string | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [seenNames, setSeenNames] = useState<Record<string, string[]>>({})

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
              const segDists: number[] = []
              for (let i = 1; i < locs.length; i++) {
                const d = haversineDistance(locs[i - 1].lat, locs[i - 1].lng, locs[i].lat, locs[i].lng)
                segDists.push(d)
                totalDist += d
              }

              const lastLoc = locs[locs.length - 1]

              return (
                <li key={day.id} className={`day-list__item${isOpen ? ' day-list__item--active' : ''}`}>
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

                  {isOpen && (
                    <div className="day-list__body">
                      {day.summary && <p className="day-list__summary">{day.summary}</p>}

                      {locs.length === 0 ? (
                        <p className="day-list__hint">Click the map to add locations</p>
                      ) : (
                        <ol className="location-list">
                          {locs.map((loc, i) => (
                            <li key={loc.id} className="location-list__item">
                              <span className="location-list__name">{loc.name}</span>
                              {i < locs.length - 1 && (
                                <span className="location-list__dist">↓ {formatDistance(segDists[i])}</span>
                              )}
                            </li>
                          ))}
                        </ol>
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
