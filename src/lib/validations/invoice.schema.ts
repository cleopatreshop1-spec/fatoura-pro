import { z } from 'zod'
import { TVA_RATES } from '@/lib/utils/tva-calculator'

export const invoiceLineSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce
    .number()
    .positive('Quantité doit être > 0'),
  unit_price: z.coerce
    .number()
    .min(0, 'Prix doit être >= 0'),
  tva_rate: z
    .number()
    .refine((v) => (TVA_RATES as readonly number[]).includes(v), {
      message: 'Taux TVA invalide (19, 13, 7 ou 0)',
    }),
})

export const invoiceSchema = z.object({
  client_id: z.string().uuid('Client invalide').optional(),
  new_client_name: z.string().optional(),
  invoice_date: z.string().min(1, "Date d'émission requise"),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  lines: z
    .array(invoiceLineSchema)
    .min(1, 'Au moins une ligne requise'),
}).refine(
  (d) => d.client_id || (d.new_client_name && d.new_client_name.trim().length >= 2),
  { message: 'Sélectionnez ou créez un client', path: ['client_id'] }
)

export type InvoiceFormData = z.infer<typeof invoiceSchema>
export type InvoiceLineFormData = z.infer<typeof invoiceLineSchema>
