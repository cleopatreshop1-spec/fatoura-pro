// src/lib/ttn/mandate-signer.ts
// Determines and returns the correct signing strategy for a company
// Per: Politique de Signature Electronique TTN v2.0 (30/06/2025)
// Section 4.3.3: Mandate (cachet entreprise) or own ANCE certificate

import { signWithMandate, signWithOwnCertificate, type SigningResult } from '@/lib/signing/xades-signer'

export interface SigningStrategy {
  mode: 'mandate' | 'own_certificate'
  sign: (xmlContent: string) => Promise<SigningResult>
}

export async function getSigningStrategy(company: any): Promise<SigningStrategy> {
  // Option 1: company has uploaded their own ANCE certificate
  if (company?.own_cert_pem && company?.own_key_pem) {
    const certPem = company.own_cert_pem as string
    const keyPem  = company.own_key_pem  as string
    const serial  = (company.ttn_registered_signers as any)?.[0]?.cert_serial ?? ''
    const email   = (company.ttn_registered_signers as any)?.[0]?.email       ?? ''

    return {
      mode: 'own_certificate',
      sign: (xml: string) => signWithOwnCertificate(xml, certPem, keyPem, serial, email),
    }
  }

  // Option 2: delegate to Fatoura Pro enterprise seal (mandate)
  return {
    mode: 'mandate',
    sign: (xml: string) => signWithMandate(xml, company?.id ?? ''),
  }
}
