'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { ActionState } from '@/types'

export async function updateDaySummary(dayId: string, summary: string): Promise<ActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  try {
    const day = await prisma.day.findUnique({
      where: { id: dayId },
      select: { trip: { select: { userId: true } } },
    })
    if (day?.trip.userId !== session.user.id) return { error: 'Not authorized' }

    await prisma.day.update({ where: { id: dayId }, data: { summary: summary.trim() || null } })
    return { success: true }
  } catch (e) {
    console.error('updateDaySummary error:', e)
    return { error: 'Failed to save description' }
  }
}
