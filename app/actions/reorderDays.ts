'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function reorderDays(updates: { id: string; dayNumber: number }[]): Promise<void> {
  await prisma.$transaction(
    updates.map(({ id, dayNumber }) =>
      prisma.day.update({ where: { id }, data: { dayNumber } })
    )
  )
  revalidatePath('/')
}
