const TTN_REJECTION_MAP: Record<string, string> = {
  'ERR_XML_INVALID':        'Format XML invalide — contactez le support',
  'ERR_SIGNATURE_INVALID':  'Signature électronique invalide — vérifiez votre certificat',
  'ERR_SIGNATURE_EXPIRED':  'Certificat de signature expiré — renouvelez votre certificat',
  'ERR_MATRICULE_EMETTEUR': 'Matricule fiscal émetteur invalide ou non reconnu par TTN',
  'ERR_MATRICULE_CLIENT':   'Matricule fiscal du client invalide',
  'ERR_DATE_INVALID':       'Date de facture invalide (format ou valeur hors plage)',
  'ERR_DATE_FUTURE':        'La date de facture ne peut pas être dans le futur',
  'ERR_AMOUNT_MISMATCH':    'Incohérence dans les montants (HT + TVA ≠ TTC)',
  'ERR_TVA_RATE':           'Taux de TVA non reconnu par TTN',
  'ERR_INVOICE_DUPLICATE':  'Ce numéro de facture existe déjà dans TTN',
  'ERR_STAMP_DUTY':         'Droit de timbre manquant ou incorrect (doit être 0,600 TND)',
  'ERR_AUTH_FAILED':        'Authentification TTN échouée — vérifiez vos credentials',
  'ERR_COMPANY_NOT_FOUND':  'Société non trouvée dans TTN — vérifiez votre matricule fiscal',
  'ERR_MANDATE_INVALID':    'Mandat de signature invalide ou expiré',
}

export function getTTNRejectionMessage(rawReason: string): string {
  if (!rawReason) return 'Rejet TTN — consultez le support pour les détails'

  if (TTN_REJECTION_MAP[rawReason]) return TTN_REJECTION_MAP[rawReason]

  for (const [code, message] of Object.entries(TTN_REJECTION_MAP)) {
    if (rawReason.toUpperCase().includes(code)) return message
  }

  const cleaned = rawReason
    .replace(/<[^>]+>/g, '')
    .replace(/faultstring/gi, '')
    .trim()

  return cleaned || 'Rejet TTN — consultez le support pour les détails'
}
