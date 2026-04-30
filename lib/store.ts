import { atom } from 'jotai'
import type { Trip, SuggestedLocation, TransportMode, RouteGeoJSON } from '@/types'

export const selectedTripAtom = atom<Trip | null>(null)
export const selectedDayIdAtom = atom<string | null>(null)
export const suggestedLocationAtom = atom<SuggestedLocation | null>(null)
export const focusedLocationAtom = atom<{ lat: number; lng: number } | null>(null)
export const mapClickedDestinationAtom = atom<string | null>(null)
export const routeModeAtom = atom<TransportMode>('driving')
export const dayRouteGeoJSONAtom = atom<RouteGeoJSON | null>(null)
export const segmentModesAtom = atom<Record<string, TransportMode>>({})
export const segmentSummaryAtom = atom<Record<string, { distance: string; duration: string }>>({})

