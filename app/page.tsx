import { prisma } from '@/lib/db'
import { TripForm } from '@/components/ui/TripForm'
import { TripList } from '@/components/trip/TripList'
import { MapView } from '@/components/map/MapView'
import type { Trip } from '@/types'

export default async function HomePage() {
  let trips: Trip[] = []
  try {
    trips = await prisma.trip.findMany({ orderBy: { createdAt: 'desc' } })
  } catch {
    // DB not yet connected
  }

  return (
    <main className="home-layout">
      <div className="home-layout__map">
        <MapView />
      </div>
      <aside className="home-layout__sidebar">
        <TripForm />
        <section className="home-layout__trips">
          <h2 className="home-layout__trips-heading">Your Trips</h2>
          <TripList trips={trips} />
        </section>
      </aside>
    </main>
  )
}
