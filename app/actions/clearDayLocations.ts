'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function clearDayLocations(dayId: string): Promise<void> {
  await prisma.locationPoint.deleteMany({ where: { dayId } })
  revalidatePath('/')
}
