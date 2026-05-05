'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import type { ActionState } from '@/types'

const schema = z.object({
  dayId: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  name: z.string().min(1, 'Name is required'),
  stopType: z.string().default('place'),
})

export async function addLocationPoint(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = schema.safeParse({
    dayId: formData.get('dayId'),
    lat: parseFloat(formData.get('lat') as string),
    lng: parseFloat(formData.get('lng') as string),
    name: formData.get('name'),
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  try {
    const lastPoint = await prisma.locationPoint.findFirst({
      where: { dayId: result.data.dayId },
      orderBy: { orderIndex: 'desc' },
    })

    await prisma.locationPoint.create({
      data: {
        dayId: result.data.dayId,
        lat: result.data.lat,
        lng: result.data.lng,
        name: result.data.name,
        orderIndex: (lastPoint?.orderIndex ?? 0) + 1,
        stopType: result.data.stopType,
      },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Failed to add location.' }
  }

  revalidatePath('/')
  return { success: true }
}
