import { z } from 'zod'

const MF_REGEX = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]{1,3}\/\d{3}$/

export const clientSchema = z.object({
  name: z.string().min(2, 'Nom requis (min. 2 caractères)'),
  type: z.enum(['B2B', 'B2C']),
  matricule_fiscal: z
    .string()
    .optional()
    .refine((v) => !v || MF_REGEX.test(v), {
      message: 'Format invalide. Exemple: 1234567A/A/M/000',
    }),
  address: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z
    .string()
    .email('Email invalide')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(1000).optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
