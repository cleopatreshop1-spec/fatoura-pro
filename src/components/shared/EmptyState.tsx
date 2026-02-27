import Link from 'next/link'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[#161b27] border border-[#1a1b22] flex items-center justify-center text-gray-700 mb-2">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-bold text-gray-300">{title}</h3>
      {description && <p className="text-xs text-gray-500 max-w-xs leading-relaxed">{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 pt-1">
          {action && (
            action.href ? (
              <Link href={action.href}
                className="px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-xl transition-colors">
                {action.label}
              </Link>
            ) : (
              <button onClick={action.onClick}
                className="px-4 py-2.5 bg-[#d4a843] hover:bg-[#f0c060] text-black text-xs font-bold rounded-xl transition-colors">
                {action.label}
              </button>
            )
          )}
          {secondaryAction && (
            <button onClick={secondaryAction.onClick}
              className="px-4 py-2.5 border border-[#1a1b22] text-xs text-gray-400 hover:text-white rounded-xl transition-colors">
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
