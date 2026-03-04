'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

export type ComboClient = {
  id: string; name: string; type: string
  matricule_fiscal: string | null; address: string | null
  gouvernorat: string | null; phone: string | null; email: string | null
  credit_limit?: number | null
}

interface Props {
  clients: ComboClient[]
  selected: ComboClient | null
  onSelect: (c: ComboClient | null) => void
  onAddNew: () => void
}

export function ClientCombobox({ clients, selected, onSelect, onAddNew }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = clients.filter(c => {
    if (!query) return true
    const q = query.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.matricule_fiscal ?? '').toLowerCase().includes(q)
  })

  function clear() { onSelect(null); setQuery(''); setOpen(false) }

  if (selected) {
    return (
      <div className="bg-[#161b27] border border-[#252830] rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-gray-200">{selected.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                selected.type === 'B2B'
                  ? 'bg-[#d4a843]/10 text-[#d4a843] border-[#d4a843]/20'
                  : 'bg-[#4a9eff]/10 text-[#4a9eff] border-[#4a9eff]/20'
              }`}>{selected.type ?? 'B2B'}</span>
            </div>
            {selected.matricule_fiscal && (
              <div className="text-[10px] font-mono text-gray-500">{selected.matricule_fiscal}</div>
            )}
            {selected.address && (
              <div className="text-[10px] text-gray-600 mt-0.5 truncate max-w-xs">{selected.address}</div>
            )}
            {selected.type === 'B2C' && (
              <div className="text-[10px] text-[#4a9eff] mt-1.5 bg-[#4a9eff]/5 border border-[#4a9eff]/15 rounded px-2 py-1">
                Facture grand public  TVA simplifiee
              </div>
            )}
          </div>
          <button onClick={clear} className="text-gray-600 hover:text-white p-1 transition-colors ml-2 shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un client par nom ou matricule..."
          className="w-full bg-[#161b27] border border-[#1a1b22] rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#d4a843] transition-colors"
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[#161b27] border border-[#252830] rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-600">Aucun client trouve</div>
          ) : (
            filtered.map(c => (
              <button key={c.id} type="button"
                onMouseDown={() => { onSelect(c); setQuery(''); setOpen(false) }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#252830] transition-colors text-left">
                <div className="min-w-0">
                  <span className="text-sm text-gray-200 block truncate">{c.name}</span>
                  {c.matricule_fiscal && (
                    <span className="text-[10px] text-gray-500 font-mono">{c.matricule_fiscal}</span>
                  )}
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ml-2 shrink-0 ${
                  c.type === 'B2B'
                    ? 'bg-[#d4a843]/10 text-[#d4a843] border-[#d4a843]/20'
                    : 'bg-[#4a9eff]/10 text-[#4a9eff] border-[#4a9eff]/20'
                }`}>{c.type ?? 'B2B'}</span>
              </button>
            ))
          )}
          <div className="border-t border-[#252830]">
            <button type="button" onMouseDown={onAddNew}
              className="w-full px-4 py-2.5 text-xs text-[#d4a843] hover:bg-[#252830] text-left transition-colors">
              + Ajouter un nouveau client
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
