'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { DiarizedSegment } from '@/lib/types'

export type AssistantShellMode = 'collapsed' | 'chat' | 'transcript'
export type RecordingPhase = 'setup' | 'recording' | 'stopping' | 'done'

export interface AssistantTranscriptSegment {
  speaker: string
  text: string
  isFinal?: boolean
}

export interface MeetingAssistantContextValue {
  sourceId: string
  meetingId: string
  meetingTitle: string
  transcriptAvailable: boolean
  transcriptText: string
  transcriptSegments: AssistantTranscriptSegment[]
  recordingPhase: RecordingPhase
  live: boolean
  isPaused: boolean
  durationSeconds: number
  recordSystemAudio?: boolean
  hasSystemAudio?: boolean
  analyserNode?: AnalyserNode | null
  onToggleRecordSystemAudio?: (checked: boolean) => void
  onStartRecording?: () => void | Promise<void>
  onTogglePause?: () => void | Promise<void>
  onStop?: () => void | Promise<void>
}

interface AssistantShellContextValue {
  mode: AssistantShellMode
  setMode: (mode: AssistantShellMode) => void
  meetingContext: MeetingAssistantContextValue | null
  setMeetingContext: (context: MeetingAssistantContextValue) => void
  clearMeetingContext: (sourceId: string) => void
}

const AssistantShellContext = createContext<AssistantShellContextValue | null>(null)

function parseTranscriptText(transcript?: string | null) {
  if (!transcript?.trim()) return []

  return transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map<AssistantTranscriptSegment>((line) => {
      const speakerMatch = line.match(/^([^:]+):\s*(.+)$/)
      if (speakerMatch) {
        return {
          speaker: speakerMatch[1].trim(),
          text: speakerMatch[2].trim(),
        }
      }

      return {
        speaker: 'Meeting',
        text: line,
      }
    })
}

export function buildAssistantTranscriptSegments({
  transcript,
  diarizedTranscript,
}: {
  transcript?: string | null
  diarizedTranscript?: DiarizedSegment[] | null
}) {
  if (diarizedTranscript && diarizedTranscript.length > 0) {
    return diarizedTranscript.map<AssistantTranscriptSegment>((segment) => ({
      speaker: segment.speaker,
      text: segment.text,
      isFinal: true,
    }))
  }

  return parseTranscriptText(transcript)
}

export function AssistantShellProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [mode, setMode] = useState<AssistantShellMode>('collapsed')
  const [meetingContext, setMeetingContextState] = useState<MeetingAssistantContextValue | null>(
    null
  )

  const setMeetingContext = useCallback((context: MeetingAssistantContextValue) => {
    setMeetingContextState(context)
  }, [])

  const clearMeetingContext = useCallback((sourceId: string) => {
    setMeetingContextState((current) => {
      if (!current || current.sourceId !== sourceId) return current
      return null
    })
  }, [])

  const value = useMemo(
    () => ({
      mode,
      setMode,
      meetingContext,
      setMeetingContext,
      clearMeetingContext,
    }),
    [clearMeetingContext, meetingContext, mode, setMeetingContext]
  )

  return (
    <AssistantShellContext.Provider value={value}>
      {children}
    </AssistantShellContext.Provider>
  )
}

export function useAssistantShellContext() {
  const context = useContext(AssistantShellContext)
  if (!context) {
    throw new Error('useAssistantShellContext must be used within AssistantShellProvider')
  }

  return context
}

export function useAssistantShellContextSafe(): AssistantShellContextValue | null {
  return useContext(AssistantShellContext)
}

export function MeetingAssistantBridge({
  context,
}: {
  context: MeetingAssistantContextValue
}) {
  const { setMeetingContext, clearMeetingContext } = useAssistantShellContext()

  useEffect(() => {
    setMeetingContext(context)
  }, [context, setMeetingContext])

  useEffect(() => {
    return () => {
      clearMeetingContext(context.sourceId)
    }
  }, [clearMeetingContext, context.sourceId])

  return null
}
