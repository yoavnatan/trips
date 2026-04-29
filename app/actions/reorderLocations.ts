'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function reorderLocations(updates: { id: string; orderIndex: number }[]): Promise<void> {
  await prisma.$transaction(
    updates.map(({ id, orderIndex }) =>
      prisma.locationPoint.update({ where: { id }, data: { orderIndex } })
    )
  )
  revalidatePath('/')
}
