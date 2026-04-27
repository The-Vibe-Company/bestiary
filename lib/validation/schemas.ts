import { z } from 'zod'

/** Bestiary domain rules — kept in one place so server actions and routes share them. */

export const VILLAGE_NAME_MIN_LENGTH = 3
export const VILLAGE_NAME_MAX_LENGTH = 30
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

export const villageNameSchema = z
  .string()
  .trim()
  .min(VILLAGE_NAME_MIN_LENGTH, `Le nom doit contenir au moins ${VILLAGE_NAME_MIN_LENGTH} caractères`)
  .max(VILLAGE_NAME_MAX_LENGTH, `Le nom ne peut pas dépasser ${VILLAGE_NAME_MAX_LENGTH} caractères`)

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH, `Le pseudo doit contenir au moins ${USERNAME_MIN_LENGTH} caractères`)
  .max(USERNAME_MAX_LENGTH, `Le pseudo ne peut pas dépasser ${USERNAME_MAX_LENGTH} caractères`)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Caractères autorisés : lettres, chiffres, tiret et underscore')

export const createUserSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email('Email invalide'),
})

export const checkUsernameSchema = z.object({
  username: usernameSchema,
})

/**
 * Returns the first validation error message, or null if `result` succeeded.
 * Lets server actions return `{ success: false, error }` shapes consistently.
 */
export function firstZodError(result: { success: boolean; error?: z.ZodError }): string | null {
  if (result.success) return null
  return result.error?.issues[0]?.message ?? 'Entrée invalide'
}
