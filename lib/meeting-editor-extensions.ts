import type { AnyExtension } from '@tiptap/core'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Typography from '@tiptap/extension-typography'
import StarterKit from '@tiptap/starter-kit'

export function createMeetingEditorExtensions(options?: {
  includePlaceholder?: boolean
  includeBubbleMenu?: boolean
}) {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    TaskList,
    TaskItem.configure({ nested: false }),
    Typography,
  ]

  if (options?.includePlaceholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: 'Start writing your notes…',
      })
    )
  }

  if (options?.includeBubbleMenu) {
    extensions.push(BubbleMenuExtension)
  }

  return extensions
}
