'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function deleteDay(dayId: string): Promise<void> {
  const day = await prisma.day.findUnique({ where: { id: dayId }, select: { tripId: true, dayNumber: true } })
  if (!day) return

  await prisma.day.delete({ where: { id: dayId } })

  await prisma.day.updateMany({
    where: { tripId: day.tripId, dayNumber: { gt: day.dayNumber } },
    data: { dayNumber: { decrement: 1 } },
  })

  revalidatePath('/')
}
