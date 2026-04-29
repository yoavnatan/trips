import { atom } from 'jotai'
import type { Trip, SuggestedLocation } from '@/types'

export const selectedTripAtom = atom<Trip | null>(null)
export const selectedDayIdAtom = atom<string | null>(null)
export const suggestedLocationAtom = atom<SuggestedLocation | null>(null)
