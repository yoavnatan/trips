'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function swapDayDates(dayIdA: string, dayIdB: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  const [dayA, dayB] = await Promise.all([
    prisma.day.findUnique({
      where: { id: dayIdA },
      select: { date: true, dayNumber: true, trip: { select: { userId: true } } },
    }),
    prisma.day.findUnique({
      where: { id: dayIdB },
      select: { date: true, dayNumber: true },
    }),
  ])

  if (!dayA || !dayB || dayA.trip.userId !== session.user.id) throw new Error('Not authorized')

  if (!dayA.date && !dayB.date) {
    // Both undated: swap dayNumbers to change relative order
    await prisma.$transaction([
      prisma.day.update({ where: { id: dayIdA }, data: { dayNumber: dayB.dayNumber } }),
      prisma.day.update({ where: { id: dayIdB }, data: { dayNumber: dayA.dayNumber } }),
    ])
  } else {
    await prisma.$transaction([
      prisma.day.update({ where: { id: dayIdA }, data: { date: dayB.date } }),
      prisma.day.update({ where: { id: dayIdB }, data: { date: dayA.date } }),
    ])
  }

  revalidatePath('/')
}
