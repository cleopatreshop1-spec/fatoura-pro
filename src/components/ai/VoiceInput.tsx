'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

type RecordingState = 'idle' | 'recording' | 'transcribing' | 'error'

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    '',
  ]
  return types.find(t => !t || MediaRecorder.isTypeSupported(t)) ?? ''
}

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur de transcription')
      }

      if (data.transcript) {
        onTranscript(data.transcript)
      }

      setState('idle')
    } catch (err) {
      setErrorMsg((err as Error).message || 'Transcription échouée')
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [onTranscript])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setRecordingSeconds(0)

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop())
      setState('idle')
    }
  }, [])

  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount:     1,
          sampleRate:       16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
      })

      streamRef.current = stream

      const mimeType = getSupportedMimeType()
      const options: MediaRecorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 64000 }
        : { audioBitsPerSecond: 64000 }

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        const mimeUsed = recorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(chunksRef.current, { type: mimeUsed })

        if (audioBlob.size < 1000) {
          setState('idle')
          return
        }

        setState('transcribing')
        await transcribeAudio(audioBlob)
      }

      recorder.start(250)
      setState('recording')

      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= 59) {
            stopRecording()
            return 0
          }
          return s + 1
        })
      }, 1000)

    } catch (err) {
      const error = err as DOMException
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMsg("Microphone refusé — Autorisez l'accès dans les paramètres du navigateur")
      } else if (error.name === 'NotFoundError') {
        setErrorMsg('Aucun microphone détecté sur cet appareil')
      } else {
        setErrorMsg('Impossible d\'accéder au microphone')
      }
      setState('error')
    }
  }, [stopRecording, transcribeAudio])

  const handleClick = () => {
    if (state === 'recording')  { stopRecording();  return }
    if (state === 'idle')       { startRecording(); return }
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'transcribing'}
        aria-label={
          state === 'recording'    ? "Arrêter l'enregistrement"  :
          state === 'transcribing' ? 'Transcription en cours...' :
          'Parler en tunisien ou français'
        }
        title="Parlez en tunisien ou français&#10;Ex: «Aamel facture l Ahmed, 500 dinar» · «Quelle est ma TVA ?»"
        className={[
          'relative p-2.5 rounded-[10px] transition-all duration-200 select-none',
          state === 'recording'
            ? 'bg-red-500/20 border border-red-500 text-red-400'
            : state === 'transcribing'
            ? 'bg-[#d4a843]/10 border border-[#d4a843]/30 text-[#d4a843]'
            : 'bg-[#161b27] border border-white/5 text-[#6b7280] hover:text-[#d4a843] hover:border-[#d4a843]/50',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        {state === 'recording' && (
          <span className="absolute inset-0 rounded-[10px] border border-red-500/50 animate-ping" />
        )}
        {state === 'transcribing' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : state === 'recording' ? (
          <Square size={16} fill="currentColor" />
        ) : (
          <Mic size={16} />
        )}
      </button>

      {state === 'recording' && (
        <div className="absolute bottom-full right-0 mb-2 z-50 bg-[#0f1118] border border-red-500/30 rounded-xl px-3 py-2 shadow-lg min-w-[180px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex items-end gap-0.5 h-4">
              {[0.4, 1, 0.6, 0.9, 0.3].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-red-500 rounded-full animate-pulse"
                  style={{ height: `${h * 100}%`, animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}
                />
              ))}
            </div>
            <span className="text-red-400 text-xs font-medium">{recordingSeconds}s</span>
          </div>
          <p className="text-[#6b7280] text-xs">Parlez en tunisien ou français</p>
          <p className="text-[#6b7280] text-[10px] mt-0.5">Cliquez ⏹ pour terminer</p>
        </div>
      )}

      {state === 'transcribing' && (
        <div className="absolute bottom-full right-0 mb-2 z-50 bg-[#0f1118] border border-[#d4a843]/30 rounded-xl px-3 py-2 shadow-lg whitespace-nowrap">
          <p className="text-[#d4a843] text-xs">✨ Transcription en cours...</p>
        </div>
      )}

      {state === 'error' && errorMsg && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-64 bg-[#0f1118] border border-[#e05a5a]/50 rounded-xl p-3 shadow-lg">
          <p className="text-[#e05a5a] text-xs leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => setState('idle')}
            className="mt-1 text-[10px] text-[#6b7280] hover:text-white"
          >
            Fermer ×
          </button>
        </div>
      )}
    </div>
  )
}
