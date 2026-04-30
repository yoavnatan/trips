import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { haversineDistance, formatDistance } from '@/lib/utils'
import { ShareMap } from '@/components/map/ShareMap'
import type { DayWithLocations } from '@/types'

interface SharePageProps {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params

  const trip = await prisma.trip.findUnique({
    where: { shareToken: token },
    include: {
      days: {
        orderBy: { dayNumber: 'asc' },
        include: { locations: { orderBy: { orderIndex: 'asc' } } },
      },
    },
  })

  if (!trip) notFound()

  return (
    <div className="share-layout">
      <div className="share-layout__map">
        <ShareMap days={trip.days} />
      </div>

      <aside className="share-layout__sidebar">
        <div className="share-sidebar">
          <div className="share-sidebar__header">
            <div>
              <h1 className="share-sidebar__title">{trip.title}</h1>
              <p className="share-sidebar__destination">{trip.destination}</p>
            </div>
            <span className="share-sidebar__readonly-badge">View only</span>
          </div>

          <p className="share-sidebar__readonly-note">
            This is a shared read-only itinerary.
          </p>

          {trip.days.length === 0 ? (
            <p className="share-sidebar__empty">No days planned yet.</p>
          ) : (
            <div className="share-days">
              {trip.days.map((day) => <ShareDay key={day.id} day={day} />)}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function ShareDay({ day }: { day: DayWithLocations }) {
  const locs = day.locations

  let totalDist = 0
  const segDists: number[] = []
  for (let i = 1; i < locs.length; i++) {
    const d = haversineDistance(locs[i - 1].lat, locs[i - 1].lng, locs[i].lat, locs[i].lng)
    segDists.push(d)
    totalDist += d
  }

  return (
    <section className="share-day">
      <div className="share-day__header">
        <h2 className="share-day__title">Day {day.dayNumber}</h2>
        {locs.length > 1 && (
          <span className="share-day__dist">{formatDistance(totalDist)} total</span>
        )}
      </div>
      {day.summary && <p className="share-day__summary">{day.summary}</p>}

      {locs.length === 0 ? (
        <p className="share-day__empty">No locations added.</p>
      ) : (
        <ol className="share-location-list">
          {locs.map((loc, i) => (
            <li key={loc.id} className="share-location">
              <div className="share-location__row">
                <span className="share-location__index">{i + 1}</span>
                <div className="share-location__info">
                  <span className="share-location__name">{loc.name}</span>
                  {loc.notes && <p className="share-location__notes">{loc.notes}</p>}
                </div>
              </div>
              {i < locs.length - 1 && (
                <div className="share-location__connector">
                  <span className="share-location__seg-dist">{formatDistance(segDists[i])}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
