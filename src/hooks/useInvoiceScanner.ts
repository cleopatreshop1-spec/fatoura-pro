'use client'

import { useState } from 'react'
import { enhanceInvoiceImage, imageFileToCanvas } from '@/lib/image/enhance'
import type { ScannedInvoice, ScanStatus } from '@/types/scanner'

export function useInvoiceScanner() {
  const [status, setStatus]   = useState<ScanStatus>('idle')
  const [result, setResult]   = useState<ScannedInvoice | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [rawText, setRawText] = useState<string>('')

  async function scanFromCanvas(canvas: HTMLCanvasElement) {
    try {
      setStatus('enhancing')
      setError(null)

      const enhanced = enhanceInvoiceImage(canvas)
      const base64   = enhanced.split(',')[1]

      setStatus('reading')
      await new Promise(r => setTimeout(r, 800))

      setStatus('structuring')

      const response = await fetch('/api/ai/scan-invoice', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      })

      if (!response.ok) {
        const errBody = await response.json()
        throw new Error(errBody.error ?? 'Scan échoué')
      }

      const { data, rawText: raw } = await response.json()
      setRawText(raw ?? '')
      setResult(data)
      setStatus('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setError(msg)
      setStatus('error')
    }
  }

  async function scanFromFile(file: File) {
    const canvas = await imageFileToCanvas(file)
    await scanFromCanvas(canvas)
  }

  function reset() {
    setStatus('idle')
    setResult(null)
    setError(null)
    setRawText('')
  }

  return { status, result, error, rawText, scanFromCanvas, scanFromFile, reset }
}
