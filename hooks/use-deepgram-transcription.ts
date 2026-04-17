import { useRef, useState, useCallback, useEffect } from 'react'
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

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY_MS = 1000

async function fetchDeepgramToken(): Promise<string> {
  const res = await fetch('/api/transcribe/realtime-token', { method: 'POST' })
  if (!res.ok) throw new Error('Could not obtain Deepgram token')
  const { key } = (await res.json()) as { key: string }
  return key
}

function buildDeepgramUrl(): string {
  const params = new URLSearchParams({
    model: 'nova-3-meeting',
    diarize: 'true',
    smart_format: 'true',
    interim_results: 'true',
    punctuate: 'true',
  })
  return `wss://api.deepgram.com/v1/listen?${params}`
}

export function useDeepgramTranscription(): UseDeepgramTranscriptionReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [liveSegments, setLiveSegments] = useState<LiveSegment[]>([])

  const socketRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const finalSegmentsRef = useRef<DiarizedSegment[]>([])
  const interimTextRef = useRef<string>('')
  const streamRef = useRef<MediaStream | null>(null)
  const stoppingRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const connectRef = useRef<(stream: MediaStream) => Promise<void>>(null!)

  const handleMessage = useCallback((event: MessageEvent) => {
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
  }, [])

  const connectSocket = useCallback(
    async (stream: MediaStream): Promise<void> => {
      const key = await fetchDeepgramToken()
      const url = buildDeepgramUrl()

      const socket = new WebSocket(url, ['token', key])
      socketRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        reconnectAttemptsRef.current = 0

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

      socket.onmessage = handleMessage

      socket.onerror = () => setIsConnected(false)

      socket.onclose = () => {
        setIsConnected(false)

        // Auto-reconnect if we're not intentionally stopping
        if (stoppingRef.current) return
        if (!streamRef.current) return

        const attempt = reconnectAttemptsRef.current
        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
          console.error('[deepgram] Max reconnection attempts reached')
          return
        }

        reconnectAttemptsRef.current = attempt + 1
        const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(`[deepgram] Connection lost, reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`)

        setTimeout(() => {
          // Stop old recorder before creating a new one
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop()
          }
          recorderRef.current = null

          const currentStream = streamRef.current
          if (currentStream && !stoppingRef.current) {
            void connectRef.current(currentStream)
          }
        }, delay)
      }
    },
    [handleMessage],
  )

  // Keep ref in sync so onclose can call latest version without circular deps
  // (Effect avoids writing to ref during render)
  const connectSocketStable = connectSocket
  useEffect(() => { connectRef.current = connectSocketStable })

  const startTranscription = useCallback(
    async (stream: MediaStream) => {
      stoppingRef.current = false
      reconnectAttemptsRef.current = 0
      streamRef.current = stream
      await connectSocket(stream)
    },
    [connectSocket],
  )

  const stopTranscription = useCallback(async (): Promise<DiarizedSegment[]> => {
    stoppingRef.current = true
    streamRef.current = null

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
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
