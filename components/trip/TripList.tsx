'use client'

import { useAtom } from 'jotai'
import { selectedTripAtom } from '@/lib/store'
import { CalendarDays } from 'lucide-react'
import type { Trip } from '@/types'

function formatDateRange(startDate: Date | null, endDate: Date | null): string | null {
  if (!startDate) return null
  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!endDate) return fmt(startDate)
  return `${fmt(startDate)} – ${fmt(endDate)}`
}

interface TripListProps {
  trips: Trip[]
}

export function TripList({ trips }: TripListProps) {
  const [selectedTrip, setSelectedTrip] = useAtom(selectedTripAtom)

  if (trips.length === 0) {
    return (
      <div className="trip-list__welcome">
        <p className="trip-list__welcome-lead">How it works:</p>
        <ol className="trip-list__steps">
          <li className="trip-list__step">
            <span className="trip-list__step-num">1</span>
            <span>Create a trip using the form above</span>
          </li>
          <li className="trip-list__step">
            <span className="trip-list__step-num">2</span>
            <span>Add days to structure your itinerary</span>
          </li>
          <li className="trip-list__step">
            <span className="trip-list__step-num">3</span>
            <span>Click the map to pin locations for each day</span>
          </li>
        </ol>
      </div>
    )
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
          {formatDateRange(trip.startDate, trip.endDate) && (
            <p className="trip-list__dates">
              <CalendarDays size={11} />
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
