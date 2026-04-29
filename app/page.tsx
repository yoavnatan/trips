import { prisma } from '@/lib/db'
import { MapView } from '@/components/map/MapView'
import { Sidebar } from '@/components/trip/Sidebar'
import type { TripWithDaysAndLocations } from '@/types'

export default async function HomePage() {
  let trips: TripWithDaysAndLocations[] = []
  try {
    trips = await prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: { locations: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    })
  } catch {
    // DB not yet connected
  }

  return (
    <main className="home-layout">
      <div className="home-layout__map">
        <MapView trips={trips} />
      </div>
      <Sidebar trips={trips} />
    </main>
  )
}
