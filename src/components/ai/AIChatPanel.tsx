'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles, Loader2, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: { action: string; data: any } | null
  isLoading?: boolean
}

const QUICK_SUGGESTIONS = [
  { icon: '📊', label: 'Ma TVA ce trimestre ?' },
  { icon: '💰', label: 'Mes meilleurs clients ce mois' },
  { icon: '⚠️', label: 'Factures en attente de soumission' },
  { icon: '📄', label: 'Aide-moi à préparer une facture' },
]

function TypingDots() {
  return (
    <div className="flex gap-1 items-center px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#d4a843] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

function MessageBubble({ msg, onAction }: { msg: Message; onAction: (action: any) => void }) {
  const isUser = msg.role === 'user'

  // Detect and render simple markdown tables / code blocks
  const renderContent = (text: string) => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      // Simple bold **text**
      const rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, `<code class="font-mono text-[#d4a843] bg-[#1a1508] px-1 rounded text-xs">$1</code>`)
      elements.push(
        <p key={i} className="leading-relaxed"
          dangerouslySetInnerHTML={{ __html: rendered }} />
      )
      i++
    }
    return elements
  }

  return (
    <div className={`flex gap-2.5 animate-in fade-in duration-200 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#1a1508] border border-[#d4a843]/40 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-[#d4a843]" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed space-y-1 ${
          isUser
            ? 'bg-[#1a1b22] text-white rounded-tr-sm'
            : 'bg-[#0f1118] border border-[#1a1b22] text-gray-200 rounded-tl-sm'
        }`}>
          {msg.isLoading ? <TypingDots /> : renderContent(msg.content)}
        </div>

        {/* Structured action card */}
        {msg.action?.action === 'create_invoice' && (
          <button onClick={() => onAction(msg.action)}
            className="flex items-center gap-2 px-3 py-2 bg-[#1a1508] border border-[#d4a843]/40 rounded-xl text-xs text-[#d4a843] font-semibold hover:bg-[#241c0a] transition-colors">
            <ExternalLink className="w-3 h-3" />
            Ouvrir dans le formulaire →
          </button>
        )}
      </div>
    </div>
  )
}

type Props = {
  onClose: () => void
  proactiveSuggestions?: string[]
}

export function AIChatPanel({ onClose, proactiveSuggestions = [] }: Props) {
  const router = useRouter()
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Initial greeting
  useEffect(() => {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
    setMessages([{
      id: 'init',
      role: 'assistant',
      content: `${greeting} ! Je suis **Fatoura AI**, votre assistant fiscal. Comment puis-je vous aider aujourd'hui ?`,
    }])
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    setShowSuggestions(false)

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed }
    const loadingMsg: Message = { id: 'loading', role: 'assistant', content: '', isLoading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const history = messages
        .filter(m => !m.isLoading && m.id !== 'init')
        .map(m => ({ role: m.role, content: m.content }))

      const res  = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationHistory: history }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
          id: Date.now().toString(),
          role: 'assistant',
          content: data.error ?? 'Une erreur s\'est produite. Réessayez.',
        }))
        return
      }

      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
        id: Date.now().toString(),
        role: 'assistant',
        content: data.text,
        action: data.action ?? null,
      }))
    } catch {
      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Connexion impossible. Vérifiez votre connexion internet.',
      }))
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleAction = useCallback((action: any) => {
    if (action?.action === 'create_invoice' && action.data) {
      const params = new URLSearchParams()
      if (action.data.client_name) params.set('client_name', action.data.client_name)
      if (action.data.lines?.length > 0) {
        params.set('lines', JSON.stringify(action.data.lines))
      }
      router.push(`/dashboard/invoices/new?${params.toString()}`)
      onClose()
    }
  }, [router, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Backdrop on mobile */}
      <div className="sm:hidden absolute inset-0 -left-full bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex flex-col h-full bg-[#0a0b0f] border-l border-[#1a1b22]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1b22] shrink-0 bg-[#0f1118]">
          <div className="w-8 h-8 rounded-full bg-[#1a1508] border border-[#d4a843]/50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#d4a843]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Fatoura AI</h3>
            <p className="text-[10px] text-gray-600">Assistant fiscal • Données en temps réel</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#161b27] text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Proactive suggestions banner */}
        {proactiveSuggestions.length > 0 && (
          <div className="px-4 py-3 border-b border-[#1a1b22] bg-[#1a1508]/40 space-y-2 shrink-0">
            {proactiveSuggestions.slice(0, 2).map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)}
                className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-[#1a1508] border border-[#d4a843]/30 text-[#d4a843] hover:bg-[#241c0a] transition-colors">
                💡 {s}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} onAction={handleAction} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestion chips */}
        {showSuggestions && (
          <div className="px-4 pb-3 flex flex-wrap gap-2 shrink-0">
            {QUICK_SUGGESTIONS.map(s => (
              <button key={s.label}
                onClick={() => sendMessage(`${s.icon} ${s.label}`)}
                className="text-xs px-3 py-1.5 rounded-full bg-[#161b27] border border-[#1a1b22] text-gray-400 hover:text-white hover:border-[#d4a843]/40 transition-colors whitespace-nowrap">
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-[#1a1b22] shrink-0 bg-[#0f1118]">
          <div className="flex gap-2 items-center bg-[#161b27] border border-[#1a1b22] rounded-xl px-3 py-2 focus-within:border-[#d4a843]/40 transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="p-1.5 rounded-lg bg-[#d4a843] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f0c060] transition-colors shrink-0">
              {loading
                ? <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                : <Send className="w-3.5 h-3.5 text-black" />
              }
            </button>
          </div>
          <p className="text-[10px] text-gray-700 mt-1.5 text-center">
            L'IA peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </div>
      </div>
    </div>
  )
}
