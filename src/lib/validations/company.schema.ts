import { z } from 'zod'

const MF_REGEX = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]{1,3}\/\d{3}$/

export const companySchema = z.object({
  name: z.string().min(2, 'Nom de société requis'),
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
  tva_regime: z.enum(['reel', 'forfait', 'exonere']).optional().default('reel'),
  bank_name: z.string().max(100).optional(),
  bank_rib: z
    .string()
    .max(30)
    .optional()
    .refine((v) => !v || /^\d{20}$/.test(v.replace(/\s/g, '')), {
      message: 'RIB invalide (20 chiffres)',
    }),
  invoice_prefix: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9-]+$/, 'Préfixe: lettres majuscules, chiffres, tirets')
    .optional()
    .default('FP'),
})

/** Use the INPUT type (pre-transform) for react-hook-form — defaults live in useForm's defaultValues */
export type CompanyFormData = z.input<typeof companySchema>
export type CompanyData = z.infer<typeof companySchema>
