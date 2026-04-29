'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import type { ActionState } from '@/types'

const schema = z.object({
  tripId: z.string().min(1),
  summary: z.string().optional(),
})

export async function addDay(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = schema.safeParse({
    tripId: formData.get('tripId'),
    summary: formData.get('summary') || undefined,
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  try {
    const lastDay = await prisma.day.findFirst({
      where: { tripId: result.data.tripId },
      orderBy: { dayNumber: 'desc' },
    })

    await prisma.day.create({
      data: {
        tripId: result.data.tripId,
        dayNumber: (lastDay?.dayNumber ?? 0) + 1,
        summary: result.data.summary,
      },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Failed to add day.' }
  }

  revalidatePath('/')
  return {}
}
