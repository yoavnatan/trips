'use client'

import { useState, useEffect, useRef } from 'react'
import { useActionState } from 'react'
import { useAtom } from 'jotai'
import { createTrip } from '@/app/actions/createTrip'
import { mapClickedDestinationAtom } from '@/lib/store'
import type { ActionState } from '@/types'


interface GeocodeSuggestion {
  place_name: string
  text: string
}

const initialState: ActionState = {}

export function TripForm() {
  const [state, formAction, pending] = useActionState(createTrip, initialState)
  const [mapClickedDestination, setMapClickedDestination] = useAtom(mapClickedDestinationAtom)
  const [destination, setDestination] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!mapClickedDestination) return
    setDestination(mapClickedDestination)
    setSuggestions([])
    setShowSuggestions(false)
    setMapClickedDestination(null)
  }, [mapClickedDestination, setMapClickedDestination])

  useEffect(() => {
    if (state.success) setDestination('')
  }, [state.success])

  function handleDestinationChange(value: string): void {
    setDestination(value)
    setSuggestions([])

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setShowSuggestions(false); return }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/mapbox/geocode?query=${encodeURIComponent(value)}&types=place,locality,region,country&limit=5`
        )
        const data = await res.json()
        const results = (data.features ?? []) as GeocodeSuggestion[]
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        // silently ignore
      }
    }, 300)
  }

  function handleSuggestionPick(suggestion: GeocodeSuggestion): void {
    setDestination(suggestion.place_name)
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <form className="trip-form" action={formAction}>
      <h2 className="trip-form__title">New Trip</h2>
      <div className="trip-form__field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="Summer in Portugal"
        />
      </div>
      <div className="trip-form__field">
        <label htmlFor="destination">Destination</label>
        <div className="trip-form__autocomplete">
          <input
            id="destination"
            name="destination"
            type="text"
            required
            placeholder="Or click the map…"
            value={destination}
            onChange={(e) => handleDestinationChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
          />
          {showSuggestions && (
            <ul className="trip-form__suggestions">
              {suggestions.map((s) => (
                <li key={s.place_name}>
                  <button
                    type="button"
                    className="trip-form__suggestion"
                    onMouseDown={() => handleSuggestionPick(s)}
                  >
                    {s.place_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {state.error && <p className="trip-form__error">{state.error}</p>}
      <button className="trip-form__submit" type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create Trip'}
      </button>
    </form>
  )
}
