import { atom } from 'jotai'
import type { Trip } from '@/types'

export const selectedTripAtom = atom<Trip | null>(null)
