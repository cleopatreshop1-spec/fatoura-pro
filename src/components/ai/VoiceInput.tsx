'use client'

import { useState, useRef } from 'react'
import { Mic, Square } from 'lucide-react'

type Props = {
  onTranscript: (text: string) => void
  disabled?: boolean
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly [index: number]: { readonly transcript: string }
}
interface SpeechRecognitionResultList {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

export function VoiceInput({ onTranscript, disabled = false }: Props) {
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  if (!isSupported) return null

  const startListening = () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const recognition = new SR()

    recognition.lang = 'fr-FR'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    let finalTranscript = ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += text
        } else {
          interim += text
        }
      }
      setInterimText(finalTranscript + interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
      const result = finalTranscript.trim()
      if (result) onTranscript(result)
    }

    recognition.onerror = () => {
      setIsListening(false)
      setInterimText('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
  }

  return (
    <div className="relative flex items-center">
      {isListening && interimText && (
        <span className="absolute bottom-full mb-1 right-0 text-[10px] text-gray-500 bg-[#161b27] px-2 py-1 rounded-lg whitespace-nowrap max-w-[200px] truncate">
          {interimText}
        </span>
      )}
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        aria-label={isListening ? "Arrêter l'enregistrement" : 'Parler à Fatoura AI'}
        className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
          isListening
            ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/40'
            : 'text-gray-500 hover:text-[#d4a843] hover:bg-[#1a1508]'
        }`}
      >
        {isListening ? (
          <Square className="w-3.5 h-3.5" />
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  )
}
