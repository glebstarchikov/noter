import { describe, it, expect } from 'bun:test'
import { normalizeStringArray, normalizeActionItems } from '../notes/note-normalization'

describe('normalizeStringArray', () => {
  it('returns empty array for undefined', () => {
    expect(normalizeStringArray(undefined)).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(normalizeStringArray([])).toEqual([])
  })

  it('trims whitespace from strings', () => {
    expect(normalizeStringArray(['  hello  ', '  world  '])).toEqual(['hello', 'world'])
  })

  it('filters out empty and whitespace-only strings', () => {
    expect(normalizeStringArray(['hello', '', '  ', 'world'])).toEqual(['hello', 'world'])
  })
})

describe('normalizeActionItems', () => {
  it('returns empty array for undefined', () => {
    expect(normalizeActionItems(undefined)).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(normalizeActionItems([])).toEqual([])
  })

  it('normalizes valid action items', () => {
    const result = normalizeActionItems([
      { task: 'Do thing', owner: 'Alice', due_date: null, done: false },
    ])
    expect(result).toEqual([
      { task: 'Do thing', owner: 'Alice', due_date: null, done: false },
    ])
  })

  it('trims task and owner', () => {
    const result = normalizeActionItems([
      { task: '  Do thing  ', owner: '  Alice  ' },
    ])
    expect(result).toEqual([
      { task: 'Do thing', owner: 'Alice', due_date: null, done: false },
    ])
  })

  it('sets owner to null when owner is empty string', () => {
    const result = normalizeActionItems([
      { task: 'Do thing', owner: '' },
    ])
    expect(result).toEqual([
      { task: 'Do thing', owner: null, due_date: null, done: false },
    ])
  })

  it('sets owner to null when owner is whitespace only', () => {
    const result = normalizeActionItems([
      { task: 'Do thing', owner: '   ' },
    ])
    expect(result).toEqual([
      { task: 'Do thing', owner: null, due_date: null, done: false },
    ])
  })

  it('sets owner to null when owner is undefined', () => {
    const result = normalizeActionItems([
      { task: 'Do thing' },
    ])
    expect(result).toEqual([
      { task: 'Do thing', owner: null, due_date: null, done: false },
    ])
  })

  it('defaults done to false when not provided', () => {
    const result = normalizeActionItems([
      { task: 'Do thing', owner: 'Alice' },
    ])
    expect(result[0].done).toBe(false)
  })

  it('preserves done=true when provided', () => {
    const result = normalizeActionItems([
      { task: 'Do thing', owner: null, done: true },
    ])
    expect(result[0].done).toBe(true)
  })

  it('filters out items with empty tasks', () => {
    const result = normalizeActionItems([
      { task: '', owner: 'Alice' },
      { task: '   ', owner: 'Bob' },
      { task: 'Valid task', owner: null },
    ])
    expect(result).toEqual([
      { task: 'Valid task', owner: null, due_date: null, done: false },
    ])
  })
})
