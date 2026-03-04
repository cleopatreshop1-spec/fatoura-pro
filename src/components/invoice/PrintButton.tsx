'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1a1b22] text-xs text-gray-400 hover:text-white hover:bg-[#161b27] transition-colors print:hidden"
    >
      🖨 Imprimer
    </button>
  )
}
