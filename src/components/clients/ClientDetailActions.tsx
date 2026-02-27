'use client'

import { useState } from 'react'
import { ClientModal } from './ClientModal'
import type { ClientRecord } from './ClientModal'

interface Props {
  clientId: string
  client: ClientRecord
  companyId: string
}

export function ClientDetailActions({ clientId, client, companyId }: Props) {
  const [open, setOpen] = useState(false)

  function handleSaved() {
    window.location.reload()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full px-4 py-2.5 rounded-xl bg-[#d4a843] hover:bg-[#f0c060] text-black text-sm font-bold transition-colors"
      >
        Modifier
      </button>
      <ClientModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={handleSaved}
        companyId={companyId}
        initial={client}
      />
    </>
  )
}
