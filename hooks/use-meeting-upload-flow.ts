import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MeetingStatus } from '@/lib/types'
import {
  readApiError,
  runLegacyPipeline,
  waitForMeetingCompletion,
} from '@/lib/meeting-pipeline'

interface ProcessingHandler {
  (state: { meetingId: string; step: MeetingStatus; error?: string }): void
}

interface SubmitMeetingAudioOptions {
  audio: Blob
  filename: string
  contentType?: string
  title: string
  duration?: number
}

export function useMeetingUploadFlow(onProcessing: ProcessingHandler) {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitMeetingAudio = useCallback(async ({
    audio,
    filename,
    contentType,
    title,
    duration,
  }: SubmitMeetingAudioOptions) => {
    if (submittingRef.current) return null
    submittingRef.current = true
    setIsSubmitting(true)
    let currentMeetingId = ''

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: meeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title,
          status: 'uploading',
          ...(typeof duration === 'number' ? { audio_duration: duration } : {}),
        })
        .select('id')
        .single()

      if (insertError || !meeting) throw new Error('Failed to create meeting')

      currentMeetingId = meeting.id
      onProcessing({ meetingId: meeting.id, step: 'uploading' })

      const extension = filename.split('.').pop()?.toLowerCase() || 'webm'
      const storagePath = `${user.id}/${meeting.id}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('meeting-audio')
        .upload(storagePath, audio, {
          contentType: contentType || 'audio/webm',
        })

      if (uploadError) throw new Error(`Failed to upload audio: ${uploadError.message}`)

      await supabase
        .from('meetings')
        .update({ audio_url: storagePath })
        .eq('id', meeting.id)

      const processRes = await fetch(`/api/meetings/${meeting.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!processRes.ok) {
        const processError = await readApiError(processRes, 'Failed to queue processing')
        if (processError.code === 'QUEUE_UNAVAILABLE') {
          await runLegacyPipeline(meeting.id, storagePath, onProcessing)
          onProcessing({ meetingId: meeting.id, step: 'done' })
          router.push(`/dashboard/${meeting.id}`)
          return meeting.id
        }

        throw new Error(processError.message)
      }

      onProcessing({ meetingId: meeting.id, step: 'transcribing' })
      await waitForMeetingCompletion(meeting.id, onProcessing)
      onProcessing({ meetingId: meeting.id, step: 'done' })
      router.push(`/dashboard/${meeting.id}`)

      return meeting.id
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
      onProcessing({ meetingId: currentMeetingId, step: 'error', error: message })
      return null
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }, [onProcessing, router])

  return {
    isSubmitting,
    submitMeetingAudio,
  }
}
