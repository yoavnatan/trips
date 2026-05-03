'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function toggleLocationVisited(locationId: string, visited: boolean): Promise<void> {
  await prisma.locationPoint.update({
    where: { id: locationId },
    data: { visited },
  })
  revalidatePath('/')
}
