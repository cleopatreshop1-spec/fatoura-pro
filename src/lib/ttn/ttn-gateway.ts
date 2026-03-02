// src/lib/ttn/ttn-gateway.ts
// Submits signed TEIF XML to TTN/ElFatoora
// Supports both Webservice (HTTPS) and SFTP modes
// Per: Guide Adhésion TTN 2025

export interface TTNSubmissionResult {
  ttnId:       string
  rawResponse: string
  reference?:  string
}

// ── Webservice submission (HTTPS POST) ────────────────────────────────────────
async function submitViaWebservice(
  signedXml: string,
  company:   any,
): Promise<TTNSubmissionResult> {
  const endpoint = process.env.TTN_WEBSERVICE_URL
  if (!endpoint) {
    throw new Error('TTN_WEBSERVICE_URL non configuré')
  }

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Accept':        'application/xml',
      ...(company?.ttn_username && company?.ttn_password
        ? { Authorization: `Basic ${Buffer.from(`${company.ttn_username}:${company.ttn_password}`).toString('base64')}` }
        : {}),
    },
    body: signedXml,
  })

  const rawResponse = await res.text()

  if (!res.ok) {
    throw new Error(`TTN webservice error ${res.status}: ${rawResponse.slice(0, 300)}`)
  }

  // Parse TTN reference from response XML
  // TTN returns: <InvoiceResponse><InvoiceID>TTN-XXXXX</InvoiceID>...</InvoiceResponse>
  const ttnIdMatch = rawResponse.match(/<InvoiceID>([^<]+)<\/InvoiceID>/)
    ?? rawResponse.match(/<ttn[_-]?id>([^<]+)<\/ttn[_-]?id>/i)
    ?? rawResponse.match(/<reference>([^<]+)<\/reference>/i)

  if (!ttnIdMatch?.[1]) {
    throw new Error(`Réponse TTN inattendue — référence introuvable: ${rawResponse.slice(0, 300)}`)
  }

  return {
    ttnId:       ttnIdMatch[1].trim(),
    rawResponse,
    reference:   ttnIdMatch[1].trim(),
  }
}

// ── SFTP submission ────────────────────────────────────────────────────────────
// SFTP support requires the 'ssh2' package. If not installed this path will
// throw a clear error — fall back to webservice mode in that case.
async function submitViaSftp(
  signedXml: string,
  invoiceNumber: string,
  company:   any,
): Promise<TTNSubmissionResult> {
  let Client: any
  try {
    const ssh2 = await import('ssh2' as any)
    Client = ssh2.Client
  } catch {
    throw new Error(
      'Package ssh2 requis pour le mode SFTP. ' +
      'Installez-le avec: npm install ssh2 @types/ssh2'
    )
  }

  const host     = company?.ttn_sftp_host     ?? process.env.TTN_SFTP_HOST
  const port     = company?.ttn_sftp_port     ?? Number(process.env.TTN_SFTP_PORT ?? 22)
  const username = company?.ttn_username      ?? process.env.TTN_SFTP_USER
  const password = company?.ttn_password      ?? process.env.TTN_SFTP_PASSWORD

  if (!host || !username || !password) {
    throw new Error('Configuration SFTP TTN incomplète (host/user/password manquants)')
  }

  const fileName  = `TEIF-${invoiceNumber.replace(/\//g, '-')}-${Date.now()}.xml`
  const remotePath = `/upload/${fileName}`

  return new Promise<TTNSubmissionResult>((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.sftp((err: any, sftp: any) => {
        if (err) { conn.end(); return reject(err) }
        const stream = sftp.createWriteStream(remotePath)
        stream.write(signedXml)
        stream.end()
        stream.on('close', () => {
          conn.end()
          // SFTP mode: TTN processes async, reference comes via webhook/callback
          // Return a placeholder — real reference arrives later via TTN callback
          const pendingRef = `SFTP-PENDING-${Date.now()}`
          resolve({
            ttnId:       pendingRef,
            rawResponse: JSON.stringify({ mode: 'sftp', file: fileName, status: 'uploaded' }),
            reference:   pendingRef,
          })
        })
        stream.on('error', (e: any) => { conn.end(); reject(e) })
      })
    })
    conn.on('error', reject)
    conn.connect({ host, port, username, password })
  })
}

// ── Main dispatch ─────────────────────────────────────────────────────────────
export async function submitToTTN(
  signedXml:     string,
  _signer:       any,
  company:       any,
): Promise<TTNSubmissionResult> {
  const mode = company?.ttn_connection_mode ?? 'webservice'

  if (mode === 'sftp') {
    const invoiceNumber = extractInvoiceNumber(signedXml)
    return submitViaSftp(signedXml, invoiceNumber, company)
  }

  return submitViaWebservice(signedXml, company)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractInvoiceNumber(xml: string): string {
  const m = xml.match(/<InvoiceNumber>([^<]+)<\/InvoiceNumber>/)
  return m?.[1] ?? `INV-${Date.now()}`
}
