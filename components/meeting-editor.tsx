'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import type { JSONContent } from '@tiptap/react'
import { Bold, Italic, Heading2, Heading3, List, ListTodo, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorAutosave } from '@/hooks/use-editor-autosave'
import { legacyMeetingToTiptap } from '@/lib/tiptap-converter'
import type { Meeting } from '@/lib/types'

interface MeetingEditorProps {
  meeting: Meeting
  editable?: boolean
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
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      aria-label={label}
      className={cn(
        'flex items-center justify-center rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

export function MeetingEditor({ meeting, editable = true }: MeetingEditorProps) {
  const initialContent: JSONContent = meeting.document_content
    ? (meeting.document_content as JSONContent)
    : legacyMeetingToTiptap(meeting)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({
        placeholder: 'Start writing your notes…',
      }),
      Typography,
      BubbleMenuExtension,
    ],
    content: initialContent,
    editable,
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none',
      },
    },
  })

  const saveState = useEditorAutosave(editable ? editor : null, meeting.id)

  if (!editor) return null

  return (
    <div className="relative">
      {/* Save indicator */}
      {saveState !== 'idle' && (
        <div
          className={cn(
            'absolute right-0 top-0 text-[11px] tabular-nums transition-opacity',
            saveState === 'saving' ? 'text-muted-foreground' : 'text-muted-foreground/60'
          )}
        >
          {saveState === 'saving' ? 'Saving…' : 'Saved'}
        </div>
      )}

      {/* Bubble menu — appears on text selection */}
      {editable && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-md"
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
