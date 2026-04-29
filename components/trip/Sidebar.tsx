'use client'

import { useAtom } from 'jotai'
import { selectedTripAtom, selectedDayIdAtom } from '@/lib/store'
import { TripForm } from '@/components/ui/TripForm'
import { TripList } from '@/components/trip/TripList'
import { TripDetail } from '@/components/trip/TripDetail'
import type { TripWithDaysAndLocations } from '@/types'

interface SidebarProps {
  trips: TripWithDaysAndLocations[]
}

export function Sidebar({ trips }: SidebarProps) {
  const [selectedTrip, setSelectedTrip] = useAtom(selectedTripAtom)
  const [, setSelectedDayId] = useAtom(selectedDayIdAtom)

  const fullTrip = trips.find((t) => t.id === selectedTrip?.id) ?? null

  function handleBack() {
    setSelectedTrip(null)
    setSelectedDayId(null)
  }

  if (fullTrip) {
    return (
      <aside className="home-layout__sidebar">
        <TripDetail trip={fullTrip} onBack={handleBack} />
      </aside>
    )
  }

  return (
    <aside className="home-layout__sidebar">
      <TripForm />
      <section className="home-layout__trips">
        <h2 className="home-layout__trips-heading">Your Trips</h2>
        <TripList trips={trips} />
      </section>
    </aside>
  )
}
