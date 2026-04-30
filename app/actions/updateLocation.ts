'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types'

const schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required'),
  notes: z.string().optional(),
})

export async function updateLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    notes: formData.get('notes'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await prisma.locationPoint.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        notes: parsed.data.notes?.trim() || null,
      },
    })
    revalidatePath('/')
    return { success: true }
  } catch {
    return { error: 'Failed to update location.' }
  }
}
