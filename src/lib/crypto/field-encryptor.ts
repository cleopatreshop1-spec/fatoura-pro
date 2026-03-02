import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_ENV   = process.env.FIELD_ENCRYPTION_KEY

function getDerivedKey(): Buffer {
  if (!KEY_ENV) throw new Error('FIELD_ENCRYPTION_KEY manquante')
  return scryptSync(KEY_ENV, 'fatoura-pro-salt', 32)
}

export function encryptField(plaintext: string): string {
  const key = getDerivedKey()
  const iv  = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map(b => b.toString('base64')).join(':')
}

export function decryptField(ciphertext: string): string {
  const key = getDerivedKey()
  const [ivB64, tagB64, dataB64] = ciphertext.split(':')
  const iv   = Buffer.from(ivB64,  'base64')
  const tag  = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64,'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data).toString('utf8') + decipher.final('utf8')
}

export function encryptIfPresent(value: string | null | undefined): string | null {
  if (!value) return null
  return encryptField(value)
}
