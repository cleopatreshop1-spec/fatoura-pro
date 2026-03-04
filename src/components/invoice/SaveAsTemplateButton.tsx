'use client'

import { useState } from 'react'
import { BookmarkPlus, X, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

interface Line {
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
}

interface Props {
  lines: Line[]
  notes?: string
}

export function SaveAsTemplateButton({ lines, notes }: Props) {
  const { activeCompany } = useCompany()
  const supabase = createClient()
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)

  const validLines = lines.filter(l => l.description.trim())

  async function handleSave() {
    if (!activeCompany?.id || !name.trim() || !validLines.length) return
    setSaving(true)
    const { data: tpl, error } = await (supabase as any)
      .from('invoice_templates')
      .insert({ company_id: activeCompany.id, name: name.trim(), notes: notes || null })
      .select('id')
      .single()
    if (!error && tpl?.id) {
      await (supabase as any).from('invoice_template_lines').insert(
        validLines.map((l, i) => ({
          template_id:  tpl.id,
          sort_order:   i,
          description:  l.description,
          quantity:     l.quantity,
          unit_price:   l.unit_price,
          tva_rate:     l.tva_rate,
        }))
      )
      setDone(true)
      setTimeout(() => { setDone(false); setOpen(false); setName('') }, 1800)
    }
    setSaving(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={validLines.length === 0}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1a1b22] bg-[#0f1118] text-xs text-gray-400 hover:text-[#d4a843] hover:border-[#d4a843]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <BookmarkPlus size={13} />
        Sauvegarder comme modèle
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!saving) setOpen(false) }} />
          <div className="relative z-10 w-full max-w-sm bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22]">
              <div className="flex items-center gap-2">
                <BookmarkPlus size={15} className="text-[#d4a843]" />
                <span className="text-sm font-bold text-white">Nouveau modèle</span>
              </div>
              <button onClick={() => setOpen(false)} disabled={saving}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#161b27] transition-colors disabled:opacity-40">
                <X size={15} />
              </button>
            </div>

            {done ? (
              <div className="p-8 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#2dd4a0]/15 border border-[#2dd4a0]/30 flex items-center justify-center">
                  <Check size={22} className="text-[#2dd4a0]" />
                </div>
                <p className="text-sm font-bold text-white">Modèle sauvegardé !</p>
                <p className="text-xs text-gray-500">{validLines.length} ligne{validLines.length > 1 ? 's' : ''} enregistrée{validLines.length > 1 ? 's' : ''}</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-xs text-gray-500">
                  {validLines.length} ligne{validLines.length > 1 ? 's' : ''} sera{validLines.length > 1 ? 'ont' : ''} incluse{validLines.length > 1 ? 's' : ''} dans ce modèle.
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Nom du modèle *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="ex: Prestation mensuelle, Maintenance..."
                    autoFocus
                    className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {saving ? <><Loader2 size={14} className="animate-spin" />Sauvegarde...</> : <><BookmarkPlus size={14} />Enregistrer</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
