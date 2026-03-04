'use client'

import { useRef, useState } from 'react'
import { Upload, X, CheckCircle, AlertTriangle, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

type ParsedRow = {
  name: string
  type: 'B2B' | 'B2C'
  matricule_fiscal: string
  email: string
  phone: string
  address: string
  gouvernorat: string
}

type ImportResult = { ok: number; skipped: number; errors: string[] }

const TEMPLATE_CSV = `Nom,Type (B2B/B2C),Matricule Fiscal,Email,Telephone,Adresse,Gouvernorat
"Société ABC","B2B","1234567A/B/M/000","contact@abc.tn","71 123 456","12 rue de Tunis, Tunis","Tunis"
"Mohamed Ben Ali","B2C","","mba@gmail.com","55 987 654","","Sfax"`

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  return lines.slice(1).map(line => {
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim())
    return {
      name:              cols[0] ?? '',
      type:              (cols[1]?.toUpperCase() === 'B2C' ? 'B2C' : 'B2B') as 'B2B' | 'B2C',
      matricule_fiscal:  cols[2] ?? '',
      email:             cols[3] ?? '',
      phone:             cols[4] ?? '',
      address:           cols[5] ?? '',
      gouvernorat:       cols[6] ?? '',
    }
  }).filter(r => r.name.length > 0)
}

interface Props {
  onDone: () => void
}

export function ClientCSVImport({ onDone }: Props) {
  const { activeCompany } = useCompany()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [open, setOpen] = useState(false)

  function handleFile(file: File) {
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setPreview(parseCSV(text))
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    if (!activeCompany?.id || !preview.length) return
    setImporting(true)
    const supabase = createClient()
    let ok = 0; let skipped = 0; const errors: string[] = []

    for (const row of preview) {
      if (!row.name) { skipped++; continue }
      const { error } = await supabase.from('clients').insert({
        company_id:        activeCompany.id,
        name:              row.name,
        type:              row.type,
        matricule_fiscal:  row.matricule_fiscal || null,
        email:             row.email || null,
        phone:             row.phone || null,
        address:           row.address || null,
        gouvernorat:       row.gouvernorat || null,
      })
      if (error) {
        if (error.code === '23505') skipped++ // duplicate
        else errors.push(`${row.name}: ${error.message}`)
      } else ok++
    }

    setResult({ ok, skipped, errors })
    setImporting(false)
    if (ok > 0) { setTimeout(onDone, 1500) }
  }

  function downloadTemplate() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }))
    a.download = 'modele_clients.csv'
    a.click()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 border border-[#1a1b22] text-sm text-gray-400 hover:text-white hover:bg-[#161b27] rounded-xl transition-colors"
      >
        <Upload size={15} />
        Importer CSV
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1b22]">
          <div>
            <h2 className="text-base font-bold text-white">Importer des clients (CSV)</h2>
            <p className="text-xs text-gray-500 mt-0.5">Importez jusqu'à 500 clients depuis un fichier CSV</p>
          </div>
          <button onClick={() => { setOpen(false); setPreview([]); setResult(null) }}
            className="text-gray-600 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Download template */}
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 text-xs text-[#d4a843] hover:text-[#f0c060] transition-colors">
            <Download size={13} />
            Télécharger le modèle CSV
          </button>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            className="border-2 border-dashed border-[#252830] hover:border-[#d4a843]/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <Upload size={28} className="text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {fileName ? <span className="text-[#d4a843] font-medium">{fileName}</span> : 'Glissez votre CSV ici ou cliquez pour sélectionner'}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">Encodage UTF-8 recommandé</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          {/* Preview */}
          {preview.length > 0 && !result && (
            <div>
              <p className="text-xs text-gray-500 mb-2">{preview.length} client{preview.length > 1 ? 's' : ''} détecté{preview.length > 1 ? 's' : ''}</p>
              <div className="max-h-48 overflow-y-auto border border-[#1a1b22] rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-[#161b27] sticky top-0">
                    <tr>
                      {['Nom', 'Type', 'MF', 'Email', 'Téléphone'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1b22]">
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-[#161b27]/50">
                        <td className="px-3 py-2 text-gray-200 font-medium">{row.name}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${row.type === 'B2B' ? 'text-[#d4a843] border-[#d4a843]/20' : 'text-[#4a9eff] border-[#4a9eff]/20'}`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">{row.matricule_fiscal || '—'}</td>
                        <td className="px-3 py-2 text-gray-400">{row.email || '—'}</td>
                        <td className="px-3 py-2 text-gray-400">{row.phone || '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr><td colSpan={5} className="px-3 py-2 text-gray-600 text-center">... et {preview.length - 50} autres</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl px-4 py-3 border ${result.errors.length > 0 ? 'bg-red-950/20 border-red-900/30' : 'bg-green-950/20 border-green-900/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                {result.errors.length > 0
                  ? <AlertTriangle size={14} className="text-red-400" />
                  : <CheckCircle size={14} className="text-green-400" />}
                <span className={`text-xs font-bold ${result.errors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {result.ok} importé{result.ok > 1 ? 's' : ''}{result.skipped > 0 ? `, ${result.skipped} ignoré${result.skipped > 1 ? 's' : ''} (doublon)` : ''}
                </span>
              </div>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-300">{e}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1a1b22]">
          <button onClick={() => { setOpen(false); setPreview([]); setResult(null) }}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#1a1b22] rounded-xl transition-colors">
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={!preview.length || importing || !!result}
            className="flex items-center gap-2 px-5 py-2 bg-[#d4a843] hover:bg-[#f0c060] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold rounded-xl transition-colors"
          >
            {importing ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Upload size={14} />}
            {importing ? 'Import en cours...' : `Importer ${preview.length > 0 ? preview.length + ' clients' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
