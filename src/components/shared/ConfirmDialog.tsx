'use client'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  dangerous = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-base font-bold text-white mb-1">{title}</h2>
        {description && (
          <p className="text-sm text-gray-400 mb-5">{description}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-gray-300 border border-[#1a1b22] hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
              dangerous
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-[#d4a843] hover:bg-[#f0c060] text-black'
            }`}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
