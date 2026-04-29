'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { ActionState } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  destination: z.string().min(1, 'Destination is required'),
})

export async function createTrip(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  const result = schema.safeParse({
    title: formData.get('title'),
    destination: formData.get('destination'),
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  try {
    await prisma.trip.create({
      data: { ...result.data, userId: session.user.id },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Failed to save trip. Is the database connected?' }
  }

  redirect('/')
}
