'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { createSession } from '@/lib/session'
import { signUpSchema, signInSchema } from '@/lib/validations/auth'

export async function signUp(prevState: any, formData: FormData) {
  try {
    // 1. Parse et valide
    const data = {
      username: formData.get('username') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    const validated = signUpSchema.parse(data)

    // 2. Vérifie username unique
    const existingUsername = await prisma.user.findUnique({
      where: { username: validated.username },
    })
    if (existingUsername) {
      return { error: 'Ce pseudo est déjà pris' }
    }

    // 3. Vérifie email unique
    const existingEmail = await prisma.user.findUnique({
      where: { email: validated.email },
    })
    if (existingEmail) {
      return { error: 'Cet email est déjà utilisé' }
    }

    // 4. Hash password
    const hashedPassword = await hashPassword(validated.password)

    // 5. Crée user
    const user = await prisma.user.create({
      data: {
        username: validated.username,
        email: validated.email,
        password: hashedPassword,
      },
    })

    // 6. Crée session
    await createSession(user.id, user.username)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: 'Une erreur est survenue' }
  }

  // 7. Redirect
  redirect('/home')
}

export async function signIn(prevState: any, formData: FormData) {
  try {
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    const validated = signInSchema.parse(data)

    // Trouve user
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (!user) {
      return { error: 'Email ou mot de passe incorrect' }
    }

    // Vérifie password
    const isValid = await verifyPassword(validated.password, user.password)
    if (!isValid) {
      return { error: 'Email ou mot de passe incorrect' }
    }

    // Crée session
    await createSession(user.id, user.username)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0].message }
    }
    return { error: 'Une erreur est survenue' }
  }

  redirect('/home')
}
