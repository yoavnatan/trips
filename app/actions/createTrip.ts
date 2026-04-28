'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import type { ActionState } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  destination: z.string().min(1, 'Destination is required'),
})

// TODO: replace with real userId from session when auth is added
const DEV_USER_ID = 'dev-user'

export async function createTrip(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = schema.safeParse({
    title: formData.get('title'),
    destination: formData.get('destination'),
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  try {
    await prisma.user.upsert({
      where: { id: DEV_USER_ID },
      update: {},
      create: { id: DEV_USER_ID, email: 'dev@local', name: 'Dev User' },
    })
    await prisma.trip.create({
      data: { ...result.data, userId: DEV_USER_ID },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Failed to save trip. Is the database connected?' }
  }

  redirect('/')
}
