import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { isDocumentSaveConflict, saveMeetingDocument } from '@/lib/document-sync'
import type { TiptapDocument } from '@/lib/tiptap-converter'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useEditorAutosave(
  editor: Editor | null,
  {
    meetingId,
    baseHash,
    onSaveSuccess,
    onConflict,
  }: {
    meetingId: string
    baseHash?: string
    onSaveSuccess?: (payload: { documentHash: string }) => void
    onConflict?: (payload: {
      currentDocument: TiptapDocument
      currentHash: string
      message: string
    }) => void
  }
) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const baseHashRef = useRef(baseHash)
  const onSaveSuccessRef = useRef(onSaveSuccess)
  const onConflictRef = useRef(onConflict)

  useEffect(() => {
    baseHashRef.current = baseHash
  }, [baseHash])

  useEffect(() => {
    onSaveSuccessRef.current = onSaveSuccess
  }, [onSaveSuccess])

  useEffect(() => {
    onConflictRef.current = onConflict
  }, [onConflict])

  useEffect(() => {
    if (!editor) return

    const save = async () => {
      const baseHash = baseHashRef.current
      if (!baseHash) return

      setSaveState('saving')
      try {
        const result = await saveMeetingDocument({
          meetingId,
          document: editor.getJSON(),
          baseHash,
        })

        if (isDocumentSaveConflict(result)) {
          setSaveState('idle')
          onConflictRef.current?.(result)
          return
        }

        retryCountRef.current = 0
        setSaveState('saved')
        onSaveSuccessRef.current?.({ documentHash: result.documentHash })
        fadeRef.current = setTimeout(() => setSaveState('idle'), 3000)
      } catch {
        // Retry once after 3s before showing error
        if (retryCountRef.current < 1) {
          retryCountRef.current += 1
          timerRef.current = setTimeout(save, 3000)
          return
        }
        setSaveState('error')
      }
    }

    const onUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (fadeRef.current) clearTimeout(fadeRef.current)
      retryCountRef.current = 0
      timerRef.current = setTimeout(save, 2000)
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)

      // Flush pending save on unmount via fetch with keepalive
      // (sendBeacon always sends POST, but the endpoint only handles PATCH)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        const pendingBaseHash = baseHashRef.current
        if (pendingBaseHash) {
          fetch(`/api/meetings/${meetingId}/document`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_content: editor.getJSON(),
              baseHash: pendingBaseHash,
            }),
            keepalive: true,
          }).catch(() => {})
        }
      }

      if (fadeRef.current) clearTimeout(fadeRef.current)
    }
  }, [editor, meetingId])

  return saveState
}
