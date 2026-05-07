'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export async function moveToDay(locationId: string, dayId: string): Promise<{ error?: string }> {
  try {
    const lastPoint = await prisma.locationPoint.findFirst({
      where: { dayId },
      orderBy: { orderIndex: 'desc' },
    })

    await prisma.locationPoint.update({
      where: { id: locationId },
      data: { dayId, orderIndex: (lastPoint?.orderIndex ?? 0) + 1 },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Failed to move location.' }
  }

  revalidatePath('/')
  return {}
}
