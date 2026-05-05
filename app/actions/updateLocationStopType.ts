'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function updateLocationStopType(locationId: string, stopType: string): Promise<void> {
  await prisma.locationPoint.update({
    where: { id: locationId },
    data: { stopType },
  })
  revalidatePath('/')
}
