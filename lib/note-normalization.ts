import { z } from 'zod'
import type { ActionItem } from '@/lib/types'
import { generatedNotesSchema } from '@/lib/schemas'

export function normalizeStringArray(values: string[] | undefined): string[] {
  if (!values) return []
  return values.map((value) => value.trim()).filter(Boolean)
}

export function normalizeActionItems(values: z.infer<typeof generatedNotesSchema>['action_items']): ActionItem[] {
  if (!values) return []

  const items: ActionItem[] = []
  for (const item of values) {
    const task = item.task.trim()
    if (!task) continue
    const owner = item.owner?.trim() ?? null
    items.push({
      task,
      owner: owner && owner.length > 0 ? owner : null,
      done: item.done ?? false,
    })
  }

  return items
}
