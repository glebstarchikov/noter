import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { isDocumentSaveConflict, saveMeetingDocument } from '@/lib/document-sync'
import type { TiptapDocument } from '@/lib/tiptap-converter'

type SaveState = 'idle' | 'saving' | 'saved'

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

        setSaveState('saved')
        onSaveSuccessRef.current?.({ documentHash: result.documentHash })
        fadeRef.current = setTimeout(() => setSaveState('idle'), 3000)
      } catch {
        setSaveState('idle')
      }
    }

    const onUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (fadeRef.current) clearTimeout(fadeRef.current)
      timerRef.current = setTimeout(save, 2000)
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (fadeRef.current) clearTimeout(fadeRef.current)
    }
  }, [editor, meetingId])

  return saveState
}
