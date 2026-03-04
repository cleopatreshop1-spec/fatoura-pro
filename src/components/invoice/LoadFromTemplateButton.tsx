'use client'

import { useState, useMemo } from 'react'
import { BookOpen, X, Loader2, ChevronRight, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'

interface TemplateLine {
  sort_order: number
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
}

interface Template {
  id: string
  name: string
  notes: string | null
  invoice_template_lines: TemplateLine[]
}

interface Props {
  onLoad: (lines: TemplateLine[], notes: string | null) => void
}

export function LoadFromTemplateButton({ onLoad }: Props) {
  const { activeCompany } = useCompany()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [deleting, setDeleting]   = useState<string | null>(null)

  async function fetchTemplates() {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await (supabase as any)
      .from('invoice_templates')
      .select('id, name, notes, invoice_template_lines(sort_order, description, quantity, unit_price, tva_rate)')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false })
    setTemplates((data ?? []) as Template[])
    setLoading(false)
  }

  function handleOpen() {
    setOpen(true)
    fetchTemplates()
  }

  function handleSelect(tpl: Template) {
    const sorted = [...tpl.invoice_template_lines].sort((a, b) => a.sort_order - b.sort_order)
    onLoad(sorted, tpl.notes)
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await (supabase as any).from('invoice_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    setDeleting(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#1a1b22] bg-[#0f1118] text-xs text-gray-400 hover:text-[#2dd4a0] hover:border-[#2dd4a0]/30 transition-colors"
      >
        <BookOpen size={13} />
        Charger un modèle
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0f1118] border border-[#1a1b22] rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1b22]">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-[#2dd4a0]" />
                <span className="text-sm font-bold text-white">Mes modèles</span>
              </div>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#161b27] transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-gray-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Chargement...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-500 mb-1">Aucun modèle sauvegardé</p>
                  <p className="text-xs text-gray-600">Utilisez le bouton &quot;Sauvegarder comme modèle&quot; dans le formulaire de facture.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(tpl => (
                    <div key={tpl.id}
                      className="flex items-center gap-2 group bg-[#161b27] border border-[#1a1b22] hover:border-[#2dd4a0]/30 rounded-xl px-3 py-3 transition-colors cursor-pointer"
                      onClick={() => handleSelect(tpl)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-[#2dd4a0] transition-colors">{tpl.name}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {tpl.invoice_template_lines.length} ligne{tpl.invoice_template_lines.length > 1 ? 's' : ''}
                          {tpl.notes && <span className="ml-2 text-gray-700">· avec notes</span>}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDelete(tpl.id) }}
                        disabled={deleting === tpl.id}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-950/20 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        {deleting === tpl.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Trash2 size={12} />}
                      </button>
                      <ChevronRight size={14} className="text-gray-600 group-hover:text-[#2dd4a0] transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
