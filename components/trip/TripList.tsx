'use client'

import { useAtom } from 'jotai'
import { selectedTripAtom } from '@/lib/store'
import type { Trip } from '@/types'

interface TripListProps {
  trips: Trip[]
}

export function TripList({ trips }: TripListProps) {
  const [selectedTrip, setSelectedTrip] = useAtom(selectedTripAtom)

  if (trips.length === 0) {
    return <p className="trip-list__empty">No trips yet — create one above!</p>
  }

  return (
    <ul className="trip-list">
      {trips.map((trip) => (
        <li
          key={trip.id}
          className={`trip-list__item${selectedTrip?.id === trip.id ? ' trip-list__item--active' : ''}`}
          onClick={() => setSelectedTrip(trip)}
        >
          <h3 className="trip-list__name">{trip.title}</h3>
          <p className="trip-list__destination">{trip.destination}</p>
        </li>
      ))}
    </ul>
  )
}
