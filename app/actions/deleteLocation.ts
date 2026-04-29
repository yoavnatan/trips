'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function deleteLocation(locationId: string): Promise<void> {
  await prisma.locationPoint.delete({ where: { id: locationId } })
  revalidatePath('/')
}
