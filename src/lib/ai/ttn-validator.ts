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
  number?: string | null
  client: {
    type?: string | null
    matricule_fiscal?: string | null
    name?: string | null
  }
  company?: {
    name?: string | null
    matricule_fiscal?: string | null
  } | null
  lines: InvoiceLineData[]
  total_ht?: number
  total_tva: number
  total_ttc?: number
  invoice_date: string
  stamp_duty: number
  hasSignature: boolean
}

// Tunisian MF formats:
//   Old format: 7digits + letter (e.g. 1234567A)
//   New format: 7digits + letter / letter / letter / 3digits (e.g. 1234567A/A/M/000)
const MF_REGEX_NEW = /^\d{7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3}$/
const MF_REGEX_OLD = /^\d{7}[A-Z]$/

// Valid TVA rates in Tunisia per DGELF/TTN
const VALID_TVA_RATES = [0, 7, 13, 19]

function isValidMF(mf: string): boolean {
  const clean = mf.replace(/\s/g, '')
  return MF_REGEX_NEW.test(clean) || MF_REGEX_OLD.test(clean)
}

export function validateBeforeTTN(invoice: InvoiceValidationData): ValidationResult {
  const issues: ValidationIssue[] = []

  // R0: Required fields
  if (!invoice.number) {
    issues.push({ severity: 'error', field: 'number', message: 'Numéro de facture manquant', autoFixable: false })
  }
  if (!invoice.invoice_date) {
    issues.push({ severity: 'error', field: 'invoice_date', message: "Date d'émission manquante", autoFixable: false })
  }
  if (!invoice.client?.name) {
    issues.push({ severity: 'error', field: 'client.name', message: 'Nom du client manquant', autoFixable: false })
  }
  if (!invoice.lines || invoice.lines.length === 0) {
    issues.push({ severity: 'error', field: 'lines', message: 'Aucune ligne de facturation', autoFixable: false })
  }

  // R1: Company matricule fiscal (seller)
  if (!invoice.company?.matricule_fiscal) {
    issues.push({
      severity: 'error',
      field: 'company.matricule_fiscal',
      message: 'Matricule fiscal fournisseur manquant — obligatoire pour TTN',
      autoFixable: false,
    })
  } else if (!isValidMF(invoice.company.matricule_fiscal)) {
    issues.push({
      severity: 'error',
      field: 'company.matricule_fiscal',
      message: `Matricule fiscal fournisseur invalide : "${invoice.company.matricule_fiscal}". Format : 1234567A/A/M/000`,
      autoFixable: false,
    })
  }

  // R2: Client matricule fiscal (B2B)
  if (invoice.client.type === 'B2B' || invoice.client.type === 'entreprise') {
    if (!invoice.client.matricule_fiscal) {
      issues.push({
        severity: 'error',
        field: 'client.matricule_fiscal',
        message: 'Matricule fiscal client obligatoire pour les factures B2B TTN',
        autoFixable: false,
      })
    } else if (!isValidMF(invoice.client.matricule_fiscal)) {
      issues.push({
        severity: 'warning',
        field: 'client.matricule_fiscal',
        message: `Format matricule client incorrect : "${invoice.client.matricule_fiscal}". Format attendu : 1234567A/A/M/000`,
        autoFixable: false,
      })
    }
  }

  // R3: TVA rates — only 0, 7, 13, 19 valid in Tunisia
  invoice.lines.forEach((line, i) => {
    if (!VALID_TVA_RATES.includes(Number(line.tva_rate))) {
      issues.push({
        severity: 'error',
        field: `lines[${i}].tva_rate`,
        message: `Ligne ${i + 1} : taux TVA ${line.tva_rate}% invalide. Taux autorisés : 0%, 7%, 13%, 19%`,
        autoFixable: false,
      })
    }
  })

  // R4: TVA amount consistency (tolerance 0.005 TND)
  const calculatedTva = invoice.lines.reduce(
    (sum, l) => sum + l.quantity * l.unit_price * (l.tva_rate / 100),
    0,
  )
  if (Math.abs(calculatedTva - invoice.total_tva) > 0.005) {
    issues.push({
      severity: 'error',
      field: 'total_tva',
      message: `Incohérence TVA : calculée ${calculatedTva.toFixed(3)} TND ≠ déclarée ${invoice.total_tva.toFixed(3)} TND`,
      autoFixable: true,
    })
  }

  // R5: TTC consistency
  if (invoice.total_ht !== undefined && invoice.total_ttc !== undefined) {
    const expectedTTC = invoice.total_ht + invoice.total_tva + 0.600
    if (Math.abs(expectedTTC - invoice.total_ttc) > 0.005) {
      issues.push({
        severity: 'error',
        field: 'total_ttc',
        message: `Total TTC incohérent : attendu ${expectedTTC.toFixed(3)} TND, déclaré ${invoice.total_ttc.toFixed(3)} TND`,
        autoFixable: true,
      })
    }
  }

  // R6: Invoice date (max 30 days in past, not future)
  if (invoice.invoice_date) {
    const invoiceDate = new Date(invoice.invoice_date)
    const daysDiff    = Math.floor((Date.now() - invoiceDate.getTime()) / 86_400_000)
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
  }

  // R7: Droit de timbre must be exactly 0.600 TND
  if (Math.abs(invoice.stamp_duty - 0.6) > 0.001) {
    issues.push({
      severity: 'error',
      field: 'stamp_duty',
      message: `Droit de timbre incorrect : ${invoice.stamp_duty} TND (doit être exactement 0,600 TND)`,
      autoFixable: true,
    })
  }

  // R8: Line items — empty descriptions / zero prices
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

  // R9: Invoice number format warning (not blocking)
  if (invoice.number && !/^[A-Z]{2,}-\d{4}-\d{3,}$/.test(invoice.number)) {
    issues.push({
      severity: 'info',
      field: 'number',
      message: `Format numéro non standard : "${invoice.number}". Format recommandé : FP-2026-0001`,
      autoFixable: false,
    })
  }

  // R10: Signature configured
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
