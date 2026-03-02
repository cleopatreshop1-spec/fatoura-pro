export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  field: string
  message: string
  autoFixable: boolean
}

export interface ValidationResult {
  score: number
  issues: ValidationIssue[]
  canSubmit: boolean
}

export interface InvoiceLineData {
  description?: string | null
  quantity: number
  unit_price: number
  tva_rate: number
}

export interface InvoiceValidationData {
  client: {
    type?: string | null
    matricule_fiscal?: string | null
  }
  lines: InvoiceLineData[]
  total_tva: number
  invoice_date: string
  stamp_duty: number
  hasSignature: boolean
}

const MF_REGEX = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}$/

export function validateBeforeTTN(invoice: InvoiceValidationData): ValidationResult {
  const issues: ValidationIssue[] = []

  // R1: Matricule fiscal client (B2B)
  if (invoice.client.type === 'B2B' || invoice.client.type === 'entreprise') {
    if (!invoice.client.matricule_fiscal) {
      issues.push({
        severity: 'error',
        field: 'client.matricule_fiscal',
        message: 'Matricule fiscal client obligatoire pour les factures B2B TTN',
        autoFixable: false,
      })
    } else if (!MF_REGEX.test(invoice.client.matricule_fiscal)) {
      issues.push({
        severity: 'warning',
        field: 'client.matricule_fiscal',
        message: `Format matricule incorrect. Format attendu : 1234567A/A/M/000 (actuel : "${invoice.client.matricule_fiscal}")`,
        autoFixable: false,
      })
    }
  }

  // R2: Cohérence des montants (tolérance 0.005 TND)
  const calculatedTva = invoice.lines.reduce(
    (sum, l) => sum + l.quantity * l.unit_price * (l.tva_rate / 100),
    0
  )
  if (Math.abs(calculatedTva - invoice.total_tva) > 0.005) {
    issues.push({
      severity: 'error',
      field: 'total_tva',
      message: `Incohérence TVA : calculée ${calculatedTva.toFixed(3)} TND ≠ déclarée ${invoice.total_tva.toFixed(3)} TND`,
      autoFixable: true,
    })
  }

  // R3: Date de facture (max 30 jours dans le passé, pas dans le futur)
  const invoiceDate = new Date(invoice.invoice_date)
  const daysDiff = Math.floor((Date.now() - invoiceDate.getTime()) / 86_400_000)
  if (invoiceDate > new Date()) {
    issues.push({
      severity: 'error',
      field: 'invoice_date',
      message: 'La date de facture ne peut pas être dans le futur',
      autoFixable: false,
    })
  } else if (daysDiff > 30) {
    issues.push({
      severity: 'error',
      field: 'invoice_date',
      message: `Date trop ancienne : ${daysDiff} jours (limite TTN : 30 jours)`,
      autoFixable: false,
    })
  }

  // R4: Droit de timbre
  if (Math.abs(invoice.stamp_duty - 0.6) > 0.001) {
    issues.push({
      severity: 'error',
      field: 'stamp_duty',
      message: `Droit de timbre incorrect : ${invoice.stamp_duty} TND (doit être 0,600 TND)`,
      autoFixable: true,
    })
  }

  // R5: Lignes vides ou prix nuls
  invoice.lines.forEach((line, i) => {
    if (!line.description?.trim()) {
      issues.push({
        severity: 'error',
        field: `lines[${i}].description`,
        message: `Ligne ${i + 1} : description vide`,
        autoFixable: false,
      })
    }
    if (line.unit_price <= 0) {
      issues.push({
        severity: 'warning',
        field: `lines[${i}].unit_price`,
        message: `Ligne ${i + 1} : prix unitaire nul ou négatif`,
        autoFixable: false,
      })
    }
  })

  // R6: Signature configurée
  if (!invoice.hasSignature) {
    issues.push({
      severity: 'error',
      field: 'signature',
      message: 'Aucune signature configurée — soumission TTN impossible',
      autoFixable: false,
    })
  }

  const errorCount   = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10)

  return {
    score,
    issues,
    canSubmit: errorCount === 0,
  }
}
