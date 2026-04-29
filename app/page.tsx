import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { MapView } from '@/components/map/MapView'
import { Sidebar } from '@/components/trip/Sidebar'
import type { TripWithDaysAndLocations } from '@/types'

export default async function HomePage() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  let trips: TripWithDaysAndLocations[] = []
  if (userId) {
    try {
      trips = await prisma.trip.findMany({
        where: { userId },
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
  }

  const user = session?.user
    ? { name: session.user.name ?? '', image: session.user.image ?? null }
    : null

  return (
    <main className="home-layout">
      <div className="home-layout__map">
        <MapView trips={trips} />
      </div>
      <Sidebar trips={trips} user={user} />
    </main>
  )
}
