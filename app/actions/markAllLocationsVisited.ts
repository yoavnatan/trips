'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types'

export async function markAllLocationsVisited(dayId: string, visited: boolean): Promise<ActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  try {
    const day = await prisma.day.findUnique({
      where: { id: dayId },
      select: { trip: { select: { userId: true } } },
    })
    if (day?.trip.userId !== session.user.id) return { error: 'Not authorized' }

    await prisma.locationPoint.updateMany({ where: { dayId }, data: { visited } })
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('markAllLocationsVisited error:', e)
    return { error: 'Failed to update' }
  }
}
