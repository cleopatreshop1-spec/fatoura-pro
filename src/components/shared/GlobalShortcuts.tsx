'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function GlobalShortcuts() {
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? ''
      const inInput = ['INPUT','TEXTAREA','SELECT'].includes(tag) || (e.target as HTMLElement)?.isContentEditable

      // Ctrl/Cmd+N  nouvelle facture (blocked in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !inInput) {
        e.preventDefault()
        router.push('/dashboard/invoices/new')
        return
      }
      // Ctrl/Cmd+F  focus search bar anywhere
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !inInput) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('fp:focusSearch'))
        return
      }
      // Escape  close any open modal (dispatched via custom event)
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('fp:escape'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return null
}
