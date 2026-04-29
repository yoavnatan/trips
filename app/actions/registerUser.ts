'use server'

import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { ActionState } from '@/types'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export async function registerUser(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const result = schema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!result.success) return { error: result.error.issues[0].message }

  const { firstName, lastName, email, password } = result.data
  const hashed = await bcrypt.hash(password, 12)

  try {
    await prisma.user.create({
      data: { email, name: `${firstName} ${lastName}`, password: hashed },
    })
    return { success: true }
  } catch {
    return { error: 'An account with this email already exists.' }
  }
}
