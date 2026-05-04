import { useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { selectedTripAtom, selectedDayIdAtom, focusedLocationIdAtom, focusedLocationAtom } from '@/lib/store'
import type { TripWithDaysAndLocations } from '@/types'

// Syncs selectedTrip / selectedDay / focusedLocation with URL search params
// (?trip=<id>&day=<id>&loc=<id>) so state survives page refresh.
export function useUrlSync(trips: TripWithDaysAndLocations[]) {
  const [selectedTrip, setSelectedTrip] = useAtom(selectedTripAtom)
  const [selectedDayId, setSelectedDayId] = useAtom(selectedDayIdAtom)
  const [focusedLocationId, setFocusedLocationId] = useAtom(focusedLocationIdAtom)
  const [, setFocusedLocation] = useAtom(focusedLocationAtom)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      const params = new URLSearchParams(window.location.search)
      const tripId = params.get('trip')
      const dayId = params.get('day')
      const locId = params.get('loc')

      if (tripId) {
        const trip = trips.find((t) => t.id === tripId)
        if (trip) {
          setSelectedTrip(trip)
          if (dayId && trip.days.some((d) => d.id === dayId)) {
            setSelectedDayId(dayId)
          }
          if (locId) {
            setFocusedLocationId(locId)
            const loc = trip.days.flatMap((d) => d.locations).find((l) => l.id === locId)
            if (loc) setFocusedLocation({ lat: loc.lat, lng: loc.lng })
          }
        }
      }
      initialized.current = true
      return
    }

    // Sync atoms → URL
    const params = new URLSearchParams()
    if (selectedTrip) {
      params.set('trip', selectedTrip.id)
      if (selectedDayId) {
        params.set('day', selectedDayId)
        if (focusedLocationId) params.set('loc', focusedLocationId)
      }
    }

    const newSearch = params.toString()
    const currentSearch = window.location.search.replace(/^\?/, '')
    if (newSearch !== currentSearch) {
      window.history.replaceState(null, '', newSearch ? `/?${newSearch}` : '/')
    }
  }, [selectedTrip?.id, selectedDayId, focusedLocationId]) // eslint-disable-line react-hooks/exhaustive-deps
}
