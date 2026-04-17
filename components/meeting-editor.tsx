'use client'

import { useEffect, useEffectEvent } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor, JSONContent } from '@tiptap/react'
import { Bold, Italic, Heading2, Heading3, List, ListTodo, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEditorAutosave } from '@/hooks/use-editor-autosave'
import { createMeetingEditorExtensions } from '@/lib/tiptap/meeting-editor-extensions'
import {
  createEmptyTiptapDocument,
  type TiptapDocument,
} from '@/lib/tiptap/tiptap-converter'
import type { Meeting } from '@/lib/types'

interface MeetingEditorProps {
  meeting: Meeting
  editable?: boolean
  onEditorReady?: (editor: Editor | null) => void
  documentContent?: JSONContent
  onContentChange?: (document: JSONContent) => void
  autosaveBaseHash?: string
  autosaveEnabled?: boolean
  onAutosaveSuccess?: (payload: { documentHash: string }) => void
  onAutosaveConflict?: (payload: {
    currentDocument: TiptapDocument
    currentHash: string
    message: string
  }) => void
}

function ToolbarButton({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      variant={active ? 'ghost' : 'ghost-icon'}
      size="icon-xs"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      aria-label={label}
      className={cn(
        'rounded-md shadow-none',
        active && 'text-foreground'
      )}
    >
      {children}
    </Button>
  )
}

export function MeetingEditor({
  meeting,
  editable = true,
  onEditorReady,
  documentContent,
  onContentChange,
  autosaveBaseHash,
  autosaveEnabled = true,
  onAutosaveSuccess,
  onAutosaveConflict,
}: MeetingEditorProps) {
  const initialContent: JSONContent =
    documentContent ?? (meeting.document_content as JSONContent | null) ?? createEmptyTiptapDocument()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createMeetingEditorExtensions({
      includePlaceholder: true,
      includeBubbleMenu: true,
    }),
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none',
      },
    },
  })

  const saveState = useEditorAutosave(editable && autosaveEnabled ? editor : null, {
    meetingId: meeting.id,
    baseHash: autosaveBaseHash,
    onSaveSuccess: onAutosaveSuccess,
    onConflict: onAutosaveConflict,
  })
  const emitEditorReady = useEffectEvent((nextEditor: Editor | null) => {
    onEditorReady?.(nextEditor)
  })
  const emitContentChange = useEffectEvent((document: JSONContent) => {
    onContentChange?.(document)
  })

  useEffect(() => {
    if (!editor || !onEditorReady) return

    emitEditorReady(editor)
    return () => emitEditorReady(null)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor || !onContentChange) return

    emitContentChange(editor.getJSON())

    const handleUpdate = () => {
      emitContentChange(editor.getJSON())
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, onContentChange])

  if (!editor) return null

  return (
    <div className="relative">
      {/* Save indicator */}
      {saveState !== 'idle' && (
        <div
          role="status"
          aria-busy={saveState === 'saving'}
          className={cn(
            'absolute right-0 top-0 text-xs transition-opacity',
            saveState === 'saving' && 'text-muted-foreground',
            saveState === 'saved' && 'text-muted-foreground/70',
            saveState === 'error' && 'text-destructive',
          )}
        >
          {saveState === 'saving' && 'Saving changes\u2026'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && 'Save failed \u2014 changes will retry on next edit'}
        </div>
      )}

      {/* Bubble menu — appears on text selection */}
      {editable && (
        <BubbleMenu
          editor={editor}
          className="surface-utility flex items-center gap-0.5 p-1 shadow-none"
        >
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Bold"
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Italic"
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            label="Heading 2"
          >
            <Heading2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            label="Heading 3"
          >
            <Heading3 className="size-3.5" />
          </ToolbarButton>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Bullet list"
          >
            <List className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            label="Task list"
          >
            <ListTodo className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            label="Blockquote"
          >
            <Quote className="size-3.5" />
          </ToolbarButton>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
