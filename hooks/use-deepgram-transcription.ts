import { useRef, useState, useCallback } from 'react'
import type { DiarizedSegment } from '@/lib/types'

export interface LiveSegment {
  speaker: string
  text: string
  isFinal: boolean
}

interface UseDeepgramTranscriptionReturn {
  startTranscription: (stream: MediaStream) => Promise<void>
  stopTranscription: () => Promise<DiarizedSegment[]>
  isConnected: boolean
  liveSegments: LiveSegment[]
}

// Map Deepgram speaker index (0, 1, 2…) to "Speaker 1", "Speaker 2"…
function speakerLabel(index: number): string {
  return `Speaker ${index + 1}`
}

export function useDeepgramTranscription(): UseDeepgramTranscriptionReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [liveSegments, setLiveSegments] = useState<LiveSegment[]>([])

  const socketRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const finalSegmentsRef = useRef<DiarizedSegment[]>([])
  const interimTextRef = useRef<string>('')

  const startTranscription = useCallback(async (stream: MediaStream) => {
    // Fetch a short-lived Deepgram key
    const res = await fetch('/api/transcribe/realtime-token', { method: 'POST' })
    if (!res.ok) throw new Error('Could not obtain Deepgram token')
    const { key } = await res.json() as { key: string }

    const params = new URLSearchParams({
      model: 'nova-3',
      diarize: 'true',
      smart_format: 'true',
      interim_results: 'true',
      punctuate: 'true',
      // No encoding/sample_rate — WebM/Opus is auto-detected by Deepgram
    })

    const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key])
    socketRef.current = socket

    socket.onopen = () => {
      setIsConnected(true)

      // Stream audio via MediaRecorder (250ms chunks)
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      recorderRef.current = recorder

      recorder.addEventListener('dataavailable', (e) => {
        if (socket.readyState === WebSocket.OPEN && e.data.size > 0) {
          socket.send(e.data)
        }
      })

      recorder.start(250)
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as {
        type: string
        channel?: {
          alternatives?: {
            transcript?: string
            words?: { word: string; speaker?: number; start: number; end: number }[]
          }[]
        }
        is_final?: boolean
      }

      if (data.type !== 'Results') return
      const alt = data.channel?.alternatives?.[0]
      if (!alt) return

      const transcript = alt.transcript?.trim() ?? ''
      if (!transcript) return

      const isFinal = data.is_final ?? false

      // Determine dominant speaker from word-level diarization
      const words = alt.words ?? []
      const speakerCounts: Record<number, number> = {}
      for (const w of words) {
        const sp = w.speaker ?? 0
        speakerCounts[sp] = (speakerCounts[sp] ?? 0) + 1
      }
      const dominantSpeaker = Object.entries(speakerCounts).sort((a, b) => b[1] - a[1])[0]
      const speakerIndex = dominantSpeaker ? Number(dominantSpeaker[0]) : 0
      const speaker = speakerLabel(speakerIndex)

      if (isFinal) {
        interimTextRef.current = ''
        const segment: DiarizedSegment = {
          speaker,
          text: transcript,
          start: words[0]?.start ?? 0,
          end: words[words.length - 1]?.end ?? 0,
        }
        finalSegmentsRef.current.push(segment)
        setLiveSegments((prev) => {
          const withoutInterim = prev.filter((s) => s.isFinal)
          return [...withoutInterim, { speaker, text: transcript, isFinal: true }]
        })
      } else {
        interimTextRef.current = transcript
        setLiveSegments((prev) => {
          const withoutInterim = prev.filter((s) => s.isFinal)
          return [...withoutInterim, { speaker, text: transcript, isFinal: false }]
        })
      }
    }

    socket.onerror = () => setIsConnected(false)
    socket.onclose = () => setIsConnected(false)
  }, [])

  const stopTranscription = useCallback(async (): Promise<DiarizedSegment[]> => {
    recorderRef.current?.stop()
    recorderRef.current = null

    if (socketRef.current) {
      // Tell Deepgram we're done
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'CloseStream' }))
      }
      socketRef.current.close()
      socketRef.current = null
    }

    setIsConnected(false)
    setLiveSegments([])

    const segments = finalSegmentsRef.current
    finalSegmentsRef.current = []
    return segments
  }, [])

  return { startTranscription, stopTranscription, isConnected, liveSegments }
}
