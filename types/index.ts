export interface Trip {
  id: string
  userId: string
  title: string
  destination: string
  shareToken: string
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface LocationPoint {
  id: string
  dayId: string
  lat: number
  lng: number
  orderIndex: number
  name: string
  notes: string | null
  visited: boolean
}

export interface Day {
  id: string
  tripId: string
  dayNumber: number
  date: Date | null
  summary: string | null
}

export interface DayWithLocations extends Day {
  locations: LocationPoint[]
}

export interface TripWithDays extends Trip {
  days: Day[]
}

export interface TripWithDaysAndLocations extends Trip {
  days: DayWithLocations[]
}

export interface ActionState {
  error?: string
  success?: boolean
}

export interface SuggestedLocation {
  lat: number
  lng: number
  name: string
}

export type TransportMode = 'driving' | 'walking' | 'cycling' | 'transit' | 'ferry' | 'flight'

export type RouteGeoJSON = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'LineString'; coordinates: number[][] }
    properties: Record<string, string>
  }>
}
