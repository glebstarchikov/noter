import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

type SaveState = 'idle' | 'saving' | 'saved'

export function useEditorAutosave(editor: Editor | null, meetingId: string) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!editor) return

    const save = async () => {
      setSaveState('saving')
      try {
        const response = await fetch(`/api/meetings/${meetingId}/document`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_content: editor.getJSON() }),
        })
        if (!response.ok) throw new Error('Save failed')
        setSaveState('saved')
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
