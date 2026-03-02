import { NextRequest } from 'next/server'
import { getAuthenticatedCompany, success, err, logActivity } from '@/lib/api-helpers'
import { encryptIfPresent } from '@/lib/crypto/field-encryptor'

export async function POST(request: NextRequest) {
  try {
    const { user, company, supabase } = await getAuthenticatedCompany(request)
    const formData = await request.formData()
    const file     = formData.get('certificate') as File | null
    const password = formData.get('password') as string | null

    if (!file) return err('Fichier certificat requis', 400)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['p12', 'pem', 'pfx'].includes(ext))
      return err('Format de fichier non supporté (.p12, .pem uniquement)', 400)

    if (file.size > 100 * 1024)
      return err('Fichier trop volumineux (max 100 KB)', 400)

    const buffer = Buffer.from(await file.arrayBuffer())

    let certPem: string | null  = null
    let keyPem:  string | null  = null
    let expiresAt:    string | null = null
    let serialNumber: string | null = null
    let issuer:       string | null = null

    if (ext === 'pem') {
      const text = buffer.toString('utf8')
      if (!text.includes('-----BEGIN CERTIFICATE-----'))
        return err('Fichier PEM invalide : en-tête certificat manquant', 400)
      certPem = text

      // Try to parse metadata with node-forge
      try {
        const forge = await import('node-forge')
        const cert  = forge.pki.certificateFromPem(text)
        expiresAt    = cert.validity.notAfter.toISOString().slice(0, 10)
        serialNumber = cert.serialNumber
        const cnAttr = cert.issuer.getField('CN')
        issuer       = cnAttr?.value ?? null

        if (new Date(cert.validity.notAfter) < new Date())
          return err(`Ce certificat a expiré le ${expiresAt}`, 400)

        if (issuer && !issuer.toUpperCase().includes('ANCE') &&
            !issuer.toUpperCase().includes('AGENCE NATIONALE'))
          return err('Ce certificat n\'est pas émis par l\'ANCE', 400)
      } catch { /* non-blocking: metadata parsing best-effort */ }

    } else {
      // .p12 / .pfx
      if (!password) return err('Mot de passe requis pour les fichiers .p12', 400)
      try {
        const forge = await import('node-forge')
        const p12Asn1 = forge.asn1.fromDer(buffer.toString('binary'))
        const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
        const bags    = p12.getBags({ bagType: forge.pki.oids.certBag })
        const certBag = bags[forge.pki.oids.certBag]?.[0]
        if (!certBag?.cert) return err('Mot de passe du certificat invalide', 400)

        certPem      = forge.pki.certificateToPem(certBag.cert)
        expiresAt    = certBag.cert.validity.notAfter.toISOString().slice(0, 10)
        serialNumber = certBag.cert.serialNumber
        const cnAttr = certBag.cert.issuer.getField('CN')
        issuer       = cnAttr?.value ?? null

        if (new Date(certBag.cert.validity.notAfter) < new Date())
          return err(`Ce certificat a expiré le ${expiresAt}`, 400)

        if (issuer && !issuer.toUpperCase().includes('ANCE') &&
            !issuer.toUpperCase().includes('AGENCE NATIONALE'))
          return err('Ce certificat n\'est pas émis par l\'ANCE', 400)

        // Extract private key
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
        const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
        if (keyBag?.key) keyPem = forge.pki.privateKeyToPem(keyBag.key)
      } catch (e: any) {
        if (e.message?.includes('Invalid password') || e.message?.includes('MAC could not be verified'))
          return err('Mot de passe du certificat invalide', 400)
        return err('Impossible de lire le fichier certificat: ' + e.message, 400)
      }
    }

    const { error: upErr } = await (supabase as any)
      .from('companies')
      .update({
        own_cert_pem: encryptIfPresent(certPem),
        own_key_pem:  encryptIfPresent(keyPem),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', company.id)

    if (upErr) return err(upErr.message, 500)

    await logActivity(supabase as any, company.id, user.id,
      'certificate_uploaded', 'company', company.id,
      `Certificat ANCE importé — expire le ${expiresAt ?? 'inconnu'}`)

    return success({ success: true, expiresAt, serialNumber, issuer })
  } catch (e: any) { return err(e.message, e.status ?? 500) }
}
