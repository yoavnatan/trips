import { atom } from 'jotai'
import type { Trip, SuggestedLocation } from '@/types'

export const selectedTripAtom = atom<Trip | null>(null)
export const selectedDayIdAtom = atom<string | null>(null)
export const suggestedLocationAtom = atom<SuggestedLocation | null>(null)
export const focusedLocationAtom = atom<{ lat: number; lng: number } | null>(null)
export const mapClickedDestinationAtom = atom<string | null>(null)
