import type { ActionItem } from '@/lib/types'

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function isActionItemArray(value: unknown): value is ActionItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.task === 'string' &&
        (item.owner === null || typeof item.owner === 'string') &&
        typeof item.done === 'boolean'
    )
  )
}
