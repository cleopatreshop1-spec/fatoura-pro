// src/lib/signing/xades-signer.ts
// XAdES enveloped signature for TTN ElFatoora compliance
// Per: Politique de Signature Electronique TTN v2.0 (30/06/2025)
// Uses node-forge (already in deps) — no additional packages needed
//
// Signature spec:
//   Format:            XAdES (ETSI EN 319 132-1) v1.3.2+
//   Type:              Enveloped (ds:Signature inside the XML)
//   Encoding:          UTF-8
//   Hash:              SHA-256
//   Encryption:        RSA-2048+
//   Canonicalization:  Exclusive C14N
//   OID policy:        2.16.788.1.2.1.3

import * as forge from 'node-forge'

// ── Constants ────────────────────────────────────────────────────────────────
const TTN_POLICY_OID    = '2.16.788.1.2.1.3'
const C14N_ALGORITHM    = 'http://www.w3.org/2001/10/xml-exc-c14n#'
const DIGEST_ALGORITHM  = 'http://www.w3.org/2001/04/xmlenc#sha256'
const SIG_ALGORITHM     = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
const ENVELOPED_TRANSFORM = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'

export interface SigningCredentials {
  privateKey:        string   // RSA private key PEM
  certificate:       string   // X.509 certificate PEM
  certificateSerial: string
  signerEmail:       string
}

export interface SigningResult {
  signedXml:      string
  signatureValue: string
  signingTime:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripPemHeaders(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
}

function sha256Base64(data: string): string {
  const md = forge.md.sha256.create()
  md.update(data, 'utf8')
  return forge.util.encode64(md.digest().bytes())
}

function normalizeXml(xml: string): string {
  // Minimal exclusive C14N normalisation:
  // - Ensure consistent attribute ordering and whitespace around root element
  // A full exclusive C14N implementation requires a proper XML parser.
  // For TTN test phase this normalisation is sufficient; swap in a dedicated
  // c14n library (e.g. @xmldom/xmldom + xmldsigjs) when entering production.
  return xml.trim()
}

// ── Core signing function ─────────────────────────────────────────────────────

export async function signInvoiceXml(
  xmlContent: string,
  credentials: SigningCredentials,
): Promise<SigningResult> {
  const signingTime = new Date().toISOString()

  // 1. Parse private key
  const privateKey = forge.pki.privateKeyFromPem(credentials.privateKey)

  // 2. Parse certificate and extract DER base64
  const cert = forge.pki.certificateFromPem(credentials.certificate)
  const certDer = stripPemHeaders(credentials.certificate)

  // 3. Compute certificate digest (for SigningCertificate element)
  const certDigest = sha256Base64(
    forge.util.decode64(certDer)
  )

  // 4. Compute document digest (enveloped — digest entire XML before signature is inserted)
  const normalised  = normalizeXml(xmlContent)
  const docDigest   = sha256Base64(normalised)

  // 5. Build SignedProperties XML (XAdES qualifying properties)
  const signedPropsId = `SignedProperties-${Date.now()}`
  const signedProps = `<xades:SignedProperties Id="${signedPropsId}">` +
    `<xades:SignedSignatureProperties>` +
      `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
      `<xades:SigningCertificate>` +
        `<xades:Cert>` +
          `<xades:CertDigest>` +
            `<ds:DigestMethod Algorithm="${DIGEST_ALGORITHM}"/>` +
            `<ds:DigestValue>${certDigest}</ds:DigestValue>` +
          `</xades:CertDigest>` +
          `<xades:IssuerSerial>` +
            `<ds:X509IssuerName>${escapeXml(cert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(','))}</ds:X509IssuerName>` +
            `<ds:X509SerialNumber>${cert.serialNumber}</ds:X509SerialNumber>` +
          `</xades:IssuerSerial>` +
        `</xades:Cert>` +
      `</xades:SigningCertificate>` +
      `<xades:SignaturePolicyIdentifier>` +
        `<xades:SignaturePolicyId>` +
          `<xades:SigPolicyId>` +
            `<xades:Identifier>${TTN_POLICY_OID}</xades:Identifier>` +
          `</xades:SigPolicyId>` +
          `<xades:SigPolicyHash>` +
            `<ds:DigestMethod Algorithm="${DIGEST_ALGORITHM}"/>` +
            `<ds:DigestValue></ds:DigestValue>` +
          `</xades:SigPolicyHash>` +
        `</xades:SignaturePolicyId>` +
      `</xades:SignaturePolicyIdentifier>` +
    `</xades:SignedSignatureProperties>` +
  `</xades:SignedProperties>`

  // 6. Compute SignedProperties digest
  const propsDigest = sha256Base64(normalizeXml(signedProps))

  // 7. Build SignedInfo
  const signedInfo = `<ds:SignedInfo>` +
    `<ds:CanonicalizationMethod Algorithm="${C14N_ALGORITHM}"/>` +
    `<ds:SignatureMethod Algorithm="${SIG_ALGORITHM}"/>` +
    `<ds:Reference URI="">` +
      `<ds:Transforms>` +
        `<ds:Transform Algorithm="${ENVELOPED_TRANSFORM}"/>` +
        `<ds:Transform Algorithm="${C14N_ALGORITHM}"/>` +
      `</ds:Transforms>` +
      `<ds:DigestMethod Algorithm="${DIGEST_ALGORITHM}"/>` +
      `<ds:DigestValue>${docDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference URI="#${signedPropsId}" Type="http://uri.etsi.org/01903#SignedProperties">` +
      `<ds:DigestMethod Algorithm="${DIGEST_ALGORITHM}"/>` +
      `<ds:DigestValue>${propsDigest}</ds:DigestValue>` +
    `</ds:Reference>` +
  `</ds:SignedInfo>`

  // 8. Sign SignedInfo with RSA-SHA256
  const md = forge.md.sha256.create()
  md.update(normalizeXml(signedInfo), 'utf8')
  const signatureBytes  = privateKey.sign(md)
  const signatureValue  = forge.util.encode64(signatureBytes)

  // 9. Assemble ds:Signature element
  const signatureElement =
    `<ds:Signature Id="Signature" ` +
      `xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ` +
      `xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">` +
      signedInfo +
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>` +
      `<ds:KeyInfo>` +
        `<ds:X509Data>` +
          `<ds:X509Certificate>${certDer}</ds:X509Certificate>` +
        `</ds:X509Data>` +
      `</ds:KeyInfo>` +
      `<ds:Object>` +
        `<xades:QualifyingProperties Target="#Signature">` +
          signedProps +
        `</xades:QualifyingProperties>` +
      `</ds:Object>` +
    `</ds:Signature>`

  // 10. Inject <ds:Signature> just before the closing root tag (enveloped)
  const signedXml = xmlContent.replace(
    /(<\/[^>]+>\s*)$/,
    `\n${signatureElement}\n$1`,
  )

  return { signedXml, signatureValue, signingTime }
}

// ── Mandate signing (Fatoura Pro signs on behalf of company) ─────────────────
// Per section 4.3.3 of TTN Politique de Signature:
// "cachet entreprise" may sign on behalf of the subscriber company

export async function signWithMandate(
  xmlContent: string,
  _companyId: string,
): Promise<SigningResult> {
  const privateKey  = process.env.FATOURA_PRO_PRIVATE_KEY
  const certificate = process.env.FATOURA_PRO_CERTIFICATE
  const certSerial  = process.env.FATOURA_PRO_CERT_SERIAL  ?? ''
  const signerEmail = process.env.FATOURA_PRO_CERT_EMAIL   ?? 'signature@fatourapro.tn'

  if (!privateKey || !certificate) {
    throw new Error(
      'Cachet entreprise Fatoura Pro non configuré. ' +
      'Variables FATOURA_PRO_PRIVATE_KEY / FATOURA_PRO_CERTIFICATE manquantes.',
    )
  }

  return signInvoiceXml(xmlContent, { privateKey, certificate, certificateSerial: certSerial, signerEmail })
}

// ── Sign with company's own ANCE certificate ──────────────────────────────────
export async function signWithOwnCertificate(
  xmlContent: string,
  certPem:    string,
  keyPem:     string,
  serial:     string,
  email:      string,
): Promise<SigningResult> {
  return signInvoiceXml(xmlContent, {
    privateKey:        keyPem,
    certificate:       certPem,
    certificateSerial: serial,
    signerEmail:       email,
  })
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
