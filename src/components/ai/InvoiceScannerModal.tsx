'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Camera, Upload, RotateCcw, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useInvoiceScanner } from '@/hooks/useInvoiceScanner'
import type { ScannedInvoice, ScannedLine } from '@/types/scanner'

interface InvoiceScannerModalProps {
  isOpen:     boolean
  onClose:    () => void
  onConfirm:  (data: ScannedInvoice) => void
}

type Tab = 'camera' | 'upload'

const SCAN_STEPS = [
  { key: 'enhancing',   label: '🔧 Amélioration de l\'image...' },
  { key: 'reading',     label: '👁️ Lecture du texte...' },
  { key: 'structuring', label: '🧠 Structuration des données...' },
]

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  if (confidence >= 0.85) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-700/40 text-emerald-400">
        <Check size={11} strokeWidth={3} /> Haute précision ({pct}%)
      </span>
    )
  }
  if (confidence >= 0.60) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-950/60 border border-yellow-700/40 text-yellow-400">
        <AlertTriangle size={11} strokeWidth={2.5} /> Vérifier les données ({pct}%)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/60 border border-red-700/40 text-red-400">
      <AlertTriangle size={11} strokeWidth={2.5} /> Données incomplètes ({pct}%)
    </span>
  )
}

function ScanProgress({ status }: { status: string }) {
  const activeIdx = SCAN_STEPS.findIndex(s => s.key === status)
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12">
      {/* Pulsing gold orb */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-[#d4a843]/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-[#d4a843]/30 animate-pulse" />
        <div className="absolute inset-4 rounded-full bg-[#d4a843]/50 flex items-center justify-center">
          <span className="text-xl">
            {status === 'enhancing' ? '🔧' : status === 'reading' ? '👁️' : '🧠'}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 w-full max-w-xs">
        {SCAN_STEPS.map((step, i) => {
          const isDone    = i < activeIdx
          const isActive  = i === activeIdx
          return (
            <div key={step.key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
              isActive  ? 'bg-[#d4a843]/10 border border-[#d4a843]/30' :
              isDone    ? 'opacity-50' : 'opacity-25'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                isDone   ? 'bg-emerald-500/30 border border-emerald-500/50' :
                isActive ? 'bg-[#d4a843]/30 border border-[#d4a843]/50' :
                           'bg-[#252830] border border-[#252830]'
              }`}>
                {isDone
                  ? <Check size={10} className="text-emerald-400" strokeWidth={3} />
                  : isActive
                    ? <div className="w-2 h-2 rounded-full bg-[#d4a843] animate-pulse" />
                    : <div className="w-2 h-2 rounded-full bg-gray-600" />
                }
              </div>
              <span className={`text-sm ${isActive ? 'text-white font-medium' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-600 text-center max-w-xs">
        Analyse en cours via Gemini AI — peut prendre 10 à 30 secondes
      </p>
    </div>
  )
}

function EditableField({
  label, value, onChange, dir
}: { label: string; value: string; onChange: (v: string) => void; dir?: 'rtl' | 'ltr' }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        dir={dir}
        className="w-full bg-[#161b27] border border-[#1a1b22] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843]/60 transition-colors"
      />
    </div>
  )
}

function ResultsPanel({
  data,
  onRescan,
  onConfirm,
}: {
  data: ScannedInvoice
  onRescan:  () => void
  onConfirm: (d: ScannedInvoice) => void
}) {
  const [edited, setEdited] = useState<ScannedInvoice>(JSON.parse(JSON.stringify(data)))
  const [linesOpen, setLinesOpen] = useState(true)

  function setVendor(field: keyof ScannedInvoice['vendor'], v: string) {
    setEdited(prev => ({ ...prev, vendor: { ...prev.vendor, [field]: v } }))
  }
  function setClient(field: keyof ScannedInvoice['client'], v: string) {
    setEdited(prev => ({ ...prev, client: { ...prev.client, [field]: v } }))
  }
  function setInvoice(field: keyof ScannedInvoice['invoice'], v: string) {
    setEdited(prev => ({ ...prev, invoice: { ...prev.invoice, [field]: v } }))
  }
  function setLine(idx: number, field: keyof ScannedLine, v: string | number) {
    setEdited(prev => {
      const lines = prev.lines.map((l, i) => {
        if (i !== idx) return l
        const updated = { ...l, [field]: v }
        updated.total_ht = Math.round(Number(updated.quantity) * Number(updated.unit_price) * 1000) / 1000
        return updated
      })
      const total_ht  = Math.round(lines.reduce((s, l) => s + l.total_ht, 0) * 1000) / 1000
      const total_tva = Math.round(lines.reduce((s, l) => s + l.total_ht * (l.tva_rate / 100), 0) * 1000) / 1000
      const total_ttc = Math.round((total_ht + total_tva + 0.600) * 1000) / 1000
      return { ...prev, lines, totals: { total_ht, total_tva, timbre: 0.600, total_ttc } }
    })
  }

  const IC = 'w-full bg-[#161b27] border border-[#1a1b22] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-[#d4a843]/60 transition-colors'

  return (
    <div className="flex flex-col h-full">
      {/* Confidence + warnings */}
      <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
        <ConfidenceBadge confidence={edited.confidence} />
        {edited.warnings.length > 0 && (
          <div className="space-y-1">
            {edited.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-950/30 border border-yellow-800/30 rounded-lg px-3 py-2">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                {w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 min-h-0">

        {/* Fournisseur */}
        <section>
          <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Fournisseur</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <EditableField label="Nom" value={edited.vendor.name} onChange={v => setVendor('name', v)} />
            </div>
            <EditableField label="Matricule Fiscal" value={edited.vendor.mf}      onChange={v => setVendor('mf', v)} />
            <EditableField label="RNE"               value={edited.vendor.rne}     onChange={v => setVendor('rne', v)} />
            <EditableField label="Téléphone"         value={edited.vendor.phone}   onChange={v => setVendor('phone', v)} />
            <div className="col-span-2">
              <EditableField label="Adresse" value={edited.vendor.address} onChange={v => setVendor('address', v)} />
            </div>
          </div>
        </section>

        {/* Client */}
        <section>
          <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Client</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <EditableField label="Nom" value={edited.client.name} onChange={v => setClient('name', v)} />
            </div>
            <EditableField label="Matricule Fiscal" value={edited.client.mf}      onChange={v => setClient('mf', v)} />
            <div className="col-span-2">
              <EditableField label="Adresse" value={edited.client.address} onChange={v => setClient('address', v)} />
            </div>
          </div>
        </section>

        {/* Facture */}
        <section>
          <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Facture</h3>
          <div className="grid grid-cols-3 gap-2">
            <EditableField label="Numéro"   value={edited.invoice.number}   onChange={v => setInvoice('number', v)} />
            <EditableField label="Date"     value={edited.invoice.date}     onChange={v => setInvoice('date', v)} />
            <EditableField label="Échéance" value={edited.invoice.due_date ?? ''} onChange={v => setInvoice('due_date', v)} />
          </div>
        </section>

        {/* Lines */}
        <section>
          <button
            onClick={() => setLinesOpen(p => !p)}
            className="flex items-center justify-between w-full text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3"
          >
            <span>Lignes de facturation ({edited.lines.length})</span>
            {linesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {linesOpen && (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid gap-1 text-[9px] text-gray-600 uppercase tracking-wider px-1"
                style={{ gridTemplateColumns: '1fr 48px 72px 56px 72px' }}>
                <span>Description</span><span>Qté</span><span>Prix U. HT</span><span>TVA%</span><span>HT</span>
              </div>
              {edited.lines.map((line, i) => (
                <div key={i} className="grid gap-1 items-center"
                  style={{ gridTemplateColumns: '1fr 48px 72px 56px 72px' }}>
                  <input value={line.description} onChange={e => setLine(i, 'description', e.target.value)} className={IC} />
                  <input value={line.quantity}    onChange={e => setLine(i, 'quantity',    Number(e.target.value))} type="number" min="0" className={IC} />
                  <input value={line.unit_price}  onChange={e => setLine(i, 'unit_price',  Number(e.target.value))} type="number" min="0" step="0.001" className={IC} />
                  <select value={line.tva_rate}  onChange={e => setLine(i, 'tva_rate', Number(e.target.value) as 0|7|13|19)}
                    className={IC}>
                    {[0, 7, 13, 19].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                  <span className="text-xs font-mono text-gray-400 text-right pr-1">{line.total_ht.toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Totals */}
        <section>
          <h3 className="text-xs font-bold text-[#d4a843] uppercase tracking-wider mb-3">Totaux</h3>
          <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl p-3 space-y-2">
            {[
              { label: 'Total HT',      value: edited.totals.total_ht },
              { label: 'Total TVA',     value: edited.totals.total_tva },
              { label: 'Droit de timbre', value: edited.totals.timbre },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{row.label}</span>
                <span className="font-mono text-gray-300">{row.value.toFixed(3)} TND</span>
              </div>
            ))}
            <div className="border-t border-[#252830] pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">TOTAL TTC</span>
              <span className="font-mono text-[#d4a843] font-black">{edited.totals.total_ttc.toFixed(3)} TND</span>
            </div>
          </div>
        </section>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-2 flex gap-2 shrink-0 border-t border-[#1a1b22]">
        <button
          onClick={onRescan}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#252830] bg-[#161b27] text-sm text-gray-300 hover:text-white hover:bg-[#252830] transition-colors"
        >
          <RotateCcw size={14} />
          Rescanner
        </button>
        <button
          onClick={() => onConfirm(edited)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors"
        >
          <Check size={14} strokeWidth={3} />
          Créer la facture
        </button>
      </div>
    </div>
  )
}

export function InvoiceScannerModal({ isOpen, onClose, onConfirm }: InvoiceScannerModalProps) {
  const [tab, setTab]                   = useState<Tab>('camera')
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null)
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)
  const [cameraError, setCameraError]   = useState<string | null>(null)
  const [streamActive, setStreamActive] = useState(false)
  const [isDragging, setIsDragging]     = useState(false)

  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { status, result, error: scanError, scanFromCanvas, scanFromFile, reset } = useInvoiceScanner()

  const isScanning = ['enhancing', 'reading', 'structuring'].includes(status)
  const isDone     = status === 'done'
  const isError    = status === 'error'

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStreamActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStreamActive(true)
    } catch {
      setCameraError('Accès à la caméra refusé. Utilisez l\'onglet Upload.')
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopCamera()
      return
    }
    if (tab === 'camera' && !capturedCanvas && !isScanning && !isDone) {
      startCamera()
    }
    return () => {
      if (!isOpen) stopCamera()
    }
  }, [isOpen, tab, capturedCanvas, isScanning, isDone, startCamera, stopCamera])

  // Stop camera when switching to upload tab
  useEffect(() => {
    if (tab === 'upload') stopCamera()
    else if (tab === 'camera' && isOpen && !capturedCanvas && !isScanning && !isDone) startCamera()
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  function handleCapture() {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width  = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(videoRef.current, 0, 0)
    stopCamera()
    setCapturedCanvas(canvas)
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9))
  }

  function handleRetake() {
    setCapturedCanvas(null)
    setPreviewUrl(null)
    reset()
    startCamera()
  }

  async function handleScanCanvas() {
    if (!capturedCanvas) return
    await scanFromCanvas(capturedCanvas)
  }

  async function handleFileChange(file: File) {
    reset()
    await scanFromFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileChange(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleFileChange(file)
    }
  }

  function handleFullReset() {
    setCapturedCanvas(null)
    setPreviewUrl(null)
    reset()
    if (tab === 'camera') startCamera()
  }

  function handleClose() {
    stopCamera()
    handleFullReset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full h-full md:h-auto md:max-h-[92vh] md:max-w-2xl flex flex-col bg-[#0a0b0f] md:rounded-2xl border border-[#252830] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1b22] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📷</span>
            <h2 className="text-sm font-bold text-white">Scanner une facture</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1b22] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tab bar — hide during scan/results */}
        {!isScanning && !isDone && (
          <div className="flex border-b border-[#1a1b22] shrink-0">
            {(['camera', 'upload'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === t
                    ? 'border-[#d4a843] text-[#d4a843]'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'camera' ? <><Camera size={14} /> Caméra</> : <><Upload size={14} /> Upload</>}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* ── SCANNING ANIMATION ── */}
          {isScanning && <ScanProgress status={status} />}

          {/* ── ERROR STATE ── */}
          {isError && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Scan échoué</p>
                <p className="text-sm text-gray-400">{scanError}</p>
              </div>
              <button onClick={handleFullReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1b22] border border-[#252830] text-sm text-white hover:bg-[#252830] transition-colors">
                <RotateCcw size={14} /> Réessayer
              </button>
            </div>
          )}

          {/* ── RESULTS ── */}
          {isDone && result && (
            <ResultsPanel data={result} onRescan={handleFullReset} onConfirm={onConfirm} />
          )}

          {/* ── CAMERA TAB ── */}
          {!isScanning && !isDone && !isError && tab === 'camera' && (
            <div className="flex flex-col flex-1 min-h-0">
              {cameraError ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center">
                    <Camera size={20} className="text-red-400" />
                  </div>
                  <p className="text-sm text-gray-400">{cameraError}</p>
                  <button onClick={() => setTab('upload')}
                    className="px-4 py-2 rounded-xl bg-[#1a1b22] border border-[#252830] text-sm text-white hover:bg-[#252830] transition-colors">
                    Utiliser l'upload
                  </button>
                </div>
              ) : previewUrl ? (
                /* Preview captured photo */
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 relative bg-black overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Photo capturée" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex gap-2 p-4 shrink-0">
                    <button onClick={handleRetake}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#252830] bg-[#161b27] text-sm text-gray-300 hover:text-white transition-colors">
                      <RotateCcw size={14} /> Reprendre
                    </button>
                    <button onClick={handleScanCanvas}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors">
                      <span>🔍</span> Scanner
                    </button>
                  </div>
                </div>
              ) : (
                /* Live camera */
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 relative bg-black overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Gold frame overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[85%] h-[75%] relative">
                        {/* Corners */}
                        {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                          <div key={i} className={`absolute ${pos} w-8 h-8`}>
                            <div className={`absolute w-full h-0.5 bg-[#d4a843] ${i < 2 ? 'top-0' : 'bottom-0'}`} />
                            <div className={`absolute h-full w-0.5 bg-[#d4a843] ${i % 2 === 0 ? 'left-0' : 'right-0'}`} />
                          </div>
                        ))}
                        <div className="absolute inset-0 border border-[#d4a843]/20 rounded-sm" />
                      </div>
                    </div>
                    {!streamActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="w-6 h-6 border-2 border-[#d4a843] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex justify-center shrink-0">
                    <button
                      onClick={handleCapture}
                      disabled={!streamActive}
                      className="w-16 h-16 rounded-full bg-white border-4 border-[#d4a843] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-lg"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#d4a843]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── UPLOAD TAB ── */}
          {!isScanning && !isDone && !isError && tab === 'upload' && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-sm flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#d4a843] bg-[#d4a843]/5'
                    : 'border-[#252830] hover:border-[#d4a843]/50 hover:bg-[#1a1b22]/50'
                }`}
              >
                <div className="w-14 h-14 rounded-xl bg-[#1a1b22] border border-[#252830] flex items-center justify-center">
                  <Upload size={22} className="text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white mb-1">Glissez une image ici</p>
                  <p className="text-xs text-gray-500">ou cliquez pour sélectionner</p>
                  <p className="text-[10px] text-gray-600 mt-2">JPG, PNG • Max 10 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
