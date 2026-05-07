'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export async function addToWishlist(tripId: string, lat: number, lng: number, name: string): Promise<{ error?: string }> {
  try {
    let wishlistDay = await prisma.day.findFirst({
      where: { tripId, dayNumber: 0 },
    })

    if (!wishlistDay) {
      wishlistDay = await prisma.day.create({
        data: { tripId, dayNumber: 0 },
      })
    }

    const lastPoint = await prisma.locationPoint.findFirst({
      where: { dayId: wishlistDay.id },
      orderBy: { orderIndex: 'desc' },
    })

    await prisma.locationPoint.create({
      data: {
        dayId: wishlistDay.id,
        lat,
        lng,
        name,
        orderIndex: (lastPoint?.orderIndex ?? 0) + 1,
      },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Failed to add to wishlist.' }
  }

  revalidatePath('/')
  return {}
}
