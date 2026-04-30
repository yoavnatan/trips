'use client'

import { useState } from 'react'
import { useAtom } from 'jotai'
import { selectedTripAtom, selectedDayIdAtom } from '@/lib/store'
import { TripForm } from '@/components/ui/TripForm'
import { TripList } from '@/components/trip/TripList'
import { TripDetail } from '@/components/trip/TripDetail'
import { AuthModal } from '@/components/ui/AuthModal'
import { signOutAction } from '@/app/actions/signOutAction'
import type { TripWithDaysAndLocations } from '@/types'

interface SidebarProps {
  trips: TripWithDaysAndLocations[]
  user: { name: string; image: string | null } | null
}

export function Sidebar({ trips, user }: SidebarProps) {
  const [selectedTrip, setSelectedTrip] = useAtom(selectedTripAtom)
  const [, setSelectedDayId] = useAtom(selectedDayIdAtom)
  const [showAuth, setShowAuth] = useState(false)

  const fullTrip = trips.find((t) => t.id === selectedTrip?.id) ?? null

  function handleBack(): void {
    setSelectedTrip(null)
    setSelectedDayId(null)
  }

  return (
    <aside className="home-layout__sidebar">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {user ? (
        <div className="sidebar-user">
          {user.image && (
            <img className="sidebar-user__avatar" src={user.image} alt={user.name} referrerPolicy="no-referrer" />
          )}
          <span className="sidebar-user__name">{user.name}</span>
          <form action={signOutAction}>
            <button type="submit" className="sidebar-user__signout">Sign out</button>
          </form>
        </div>
      ) : (
        <div className="sidebar-guest">
          <p className="sidebar-guest__text">Plan trips day by day, pin locations on the map, and share your itinerary.</p>
          <button className="sidebar-guest__btn" onClick={() => setShowAuth(true)}>
            Sign in / Register
          </button>
        </div>
      )}

      {fullTrip ? (
        <TripDetail trip={fullTrip} onBack={handleBack} />
      ) : user ? (
        <>
          <TripForm />
          <section className="home-layout__trips">
            <h2 className="home-layout__trips-heading">Your Trips</h2>
            <TripList trips={trips} />
          </section>
        </>
      ) : null}
    </aside>
  )
}
