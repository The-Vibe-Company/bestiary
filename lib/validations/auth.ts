import { z } from 'zod'

export const signUpSchema = z.object({
  username: z.string()
    .min(3, "Minimum 3 caractères")
    .max(20, "Maximum 20 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
  email: z.string().email("Email invalide"),
  password: z.string()
    .min(8, "Minimum 8 caractères")
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[0-9]/, "Au moins un chiffre")
})

export const signInSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis")
})

export const usernameSchema = z.object({
  username: z.string()
    .min(3, "Minimum 3 caractères")
    .max(20, "Maximum 20 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement")
})
