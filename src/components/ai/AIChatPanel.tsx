'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { parseAIResponse } from '@/lib/ai/action-parser'
import type { InvoiceAction } from '@/lib/ai/action-parser'
import { VoiceInput } from '@/components/ai/VoiceInput'
import { InvoiceActionCard } from '@/components/ai/InvoiceActionCard'

type GeminiPart    = { text: string }
type GeminiMessage = { role: 'user' | 'model'; parts: GeminiPart[] }

type Message = {
  id: string
  role: 'user' | 'model'
  content: string
  action?: InvoiceAction | null
  isLoading?: boolean
  isQuota?: boolean
}

const QUICK_SUGGESTIONS = [
  { icon: '📊', label: 'TVA ce trimestre' },
  { icon: '💰', label: 'Mes meilleurs clients' },
  { icon: '⚠️', label: 'Factures à soumettre' },
  { icon: '📄', label: 'Nouvelle facture rapide' },
  { icon: '📈', label: 'Mon score fiscal' },
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

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    const html = line
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g,
        '<code class="font-mono text-[#d4a843] bg-[#1a1508] px-1 rounded text-xs">$1</code>')
    return <p key={i} className="leading-relaxed min-h-[1em]"
      dangerouslySetInnerHTML={{ __html: html }} />
  })
}

function MessageBubble({
  msg,
  onActionSuccess,
  onActionEdit,
}: {
  msg: Message
  onActionSuccess: (invoiceId: string, invoiceNumber: string, msgId: string) => void
  onActionEdit: (action: InvoiceAction) => void
}) {
  const isUser = msg.role === 'user'

  if (msg.isQuota) {
    return (
      <div className="mx-1 px-4 py-3 rounded-xl bg-[#1a1508]/60 border border-[#d4a843]/20 text-xs text-[#d4a843]">
        {msg.content}
      </div>
    )
  }

  return (
    <div className={`flex gap-2.5 animate-in fade-in duration-200 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#1a1508] border border-[#d4a843]/40 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-[#d4a843]" />
        </div>
      )}
      <div className={`max-w-[85%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {msg.content && (
          <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed space-y-1 ${
            isUser
              ? 'bg-[#1a1b22] text-white rounded-tr-sm'
              : 'bg-[#0f1118] border border-[#1a1b22] text-gray-200 rounded-tl-sm'
          }`}>
            {msg.isLoading ? <TypingDots /> : renderMarkdown(msg.content)}
          </div>
        )}

        {!isUser && msg.action?.type === 'CREATE_INVOICE' && (
          <InvoiceActionCard
            action={msg.action}
            onSuccess={(id, number) => onActionSuccess(id, number, msg.id)}
            onEdit={() => onActionEdit(msg.action!)}
          />
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
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [voicePending, setVoicePending]   = useState(false)
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Gemini conversation history (role: 'user' | 'model')
  const [geminiHistory, setGeminiHistory] = useState<GeminiMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = new Date().getHours()
    const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
    setMessages([{
      id: 'init',
      role: 'model',
      content: `${greeting} ! Je suis **Fatoura AI**, votre assistant fiscal. Comment puis-je vous aider aujourd'hui ?`,
    }])
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    setShowSuggestions(false)

    const userMsg: Message    = { id: Date.now().toString(), role: 'user', content: trimmed }
    const loadingMsg: Message = { id: 'loading', role: 'model', content: '', isLoading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const res  = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: geminiHistory }),
      })
      const data = await res.json()

      // Quota error — show soft warning, not red error
      if (data.error === 'quota_exceeded') {
        setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
          id: Date.now().toString(),
          role: 'model',
          content: data.message,
          isQuota: true,
        }))
        return
      }

      const rawMessage = (data.message ?? 'Une erreur est survenue.') as string
      const { text: aiText, action } = parseAIResponse(rawMessage)

      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
        id: Date.now().toString(),
        role: 'model',
        content: aiText,
        action: action ?? null,
      }))

      // Update Gemini history for next turn (use clean text only)
      setGeminiHistory(prev => [
        ...prev,
        { role: 'user',  parts: [{ text: trimmed }] },
        { role: 'model', parts: [{ text: aiText }] },
      ])
    } catch {
      setMessages(prev => prev.filter(m => m.id !== 'loading').concat({
        id: Date.now().toString(),
        role: 'model',
        content: 'Connexion impossible. Vérifiez votre connexion internet.',
      }))
    } finally {
      setLoading(false)
    }
  }, [loading, geminiHistory])

  const handleActionSuccess = useCallback(
    (invoiceId: string, invoiceNumber: string, _msgId: string) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: `Parfait ! La facture **${invoiceNumber}** a été créée. Tu peux maintenant la soumettre à TTN.`,
        action: null,
      }])
    },
    []
  )

  const handleActionEdit = useCallback(
    (action: InvoiceAction) => {
      const params = new URLSearchParams({ prefill: JSON.stringify(action.data) })
      router.push(`/dashboard/invoices/new?${params}`)
      onClose()
    },
    [router, onClose]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="relative flex flex-col h-full bg-[#0a0b0f] border-l border-[#1a1b22]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1b22] shrink-0 bg-[#0f1118]">
          <div className="w-8 h-8 rounded-full bg-[#1a1508] border border-[#d4a843]/50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#d4a843]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">✨ Fatoura AI</h3>
              <span className="text-[9px] text-gray-600 border border-gray-700 rounded px-1 py-0.5 leading-none">
                Powered by Gemini
              </span>
            </div>
            <p className="text-[10px] text-gray-600 mt-0.5">Assistant fiscal • Données en temps réel</p>
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
            <MessageBubble
              key={msg.id}
              msg={msg}
              onActionSuccess={handleActionSuccess}
              onActionEdit={handleActionEdit}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick chips */}
        {showSuggestions && (
          <div className="px-4 pb-3 flex flex-wrap gap-2 shrink-0 border-t border-[#1a1b22] pt-3">
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
        <div className="px-4 pb-4 pt-3 border-t border-[#1a1b22] shrink-0 bg-[#0f1118]">
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
            <VoiceInput
              disabled={loading}
              onTranscript={(text) => {
                setInput(text)
                setVoicePending(true)
                if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current)
                voiceTimerRef.current = setTimeout(() => {
                  setVoicePending(false)
                  sendMessage(text)
                }, 3000)
              }}
            />
            <button
              onClick={() => {
                if (voicePending) {
                  if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current)
                  setVoicePending(false)
                  sendMessage(input)
                } else {
                  sendMessage(input)
                }
              }}
              disabled={loading || (!input.trim() && !voicePending)}
              className="p-1.5 rounded-lg bg-[#d4a843] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f0c060] transition-colors shrink-0">
              {loading
                ? <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                : <Send className="w-3.5 h-3.5 text-black" />}
            </button>
          </div>
          {voicePending && (
            <div className="flex items-center gap-2 px-1 mt-1.5 text-xs text-[#d4a843] animate-pulse">
              <span className="w-1.5 h-1.5 bg-[#d4a843] rounded-full shrink-0" />
              Envoi dans 3 secondes... (cliquez ➤ pour envoyer maintenant)
            </div>
          )}
          {!voicePending && (
            <p className="text-[10px] text-gray-700 mt-1.5 text-center">
              L'IA peut faire des erreurs. Vérifiez les informations importantes.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
