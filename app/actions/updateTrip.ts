'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { ActionState } from '@/types'

export async function updateTrip(tripId: string, startDate: Date | null, endDate: Date | null): Promise<ActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  try {
    await prisma.trip.update({
      where: { id: tripId, userId: session.user.id },
      data: { startDate, endDate },
    })
    return { success: true }
  } catch (e) {
    console.error('updateTrip error:', e)
    return { error: 'Failed to update trip' }
  }
}
