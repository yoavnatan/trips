'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { ActionState } from '@/types'

export async function updateTripStyle(tripId: string, tripStyle: string[]): Promise<ActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  try {
    await prisma.trip.update({
      where: { id: tripId, userId: session.user.id },
      data: { tripStyle },
    })
    return { success: true }
  } catch (e) {
    console.error('updateTripStyle error:', e)
    return { error: 'Failed to update trip style' }
  }
}
