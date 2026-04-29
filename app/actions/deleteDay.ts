'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function deleteDay(dayId: string): Promise<void> {
  await prisma.day.delete({ where: { id: dayId } })
  revalidatePath('/')
}
