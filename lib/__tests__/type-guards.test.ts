import { describe, it, expect } from 'bun:test'
import { isStringArray, isActionItemArray } from '../type-guards'

describe('isStringArray', () => {
  it('returns true for an array of strings', () => {
    expect(isStringArray(['a', 'b', 'c'])).toBe(true)
  })

  it('returns true for an empty array', () => {
    expect(isStringArray([])).toBe(true)
  })

  it('returns false for an array with non-strings', () => {
    expect(isStringArray(['a', 1, 'c'])).toBe(false)
  })

  it('returns false for null', () => {
    expect(isStringArray(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isStringArray(undefined)).toBe(false)
  })

  it('returns false for a plain string', () => {
    expect(isStringArray('hello')).toBe(false)
  })

  it('returns false for an object', () => {
    expect(isStringArray({ 0: 'a' })).toBe(false)
  })
})

describe('isActionItemArray', () => {
  it('returns true for a valid action item array', () => {
    expect(
      isActionItemArray([
        { task: 'Do thing', owner: 'Alice', done: false },
        { task: 'Other thing', owner: null, done: true },
      ])
    ).toBe(true)
  })

  it('returns true for an empty array', () => {
    expect(isActionItemArray([])).toBe(true)
  })

  it('returns false when task is missing', () => {
    expect(isActionItemArray([{ owner: 'Alice', done: false }])).toBe(false)
  })

  it('returns false when done is not boolean', () => {
    expect(
      isActionItemArray([{ task: 'Do thing', owner: null, done: 'yes' }])
    ).toBe(false)
  })

  it('returns false when owner is a number', () => {
    expect(
      isActionItemArray([{ task: 'Do thing', owner: 123, done: false }])
    ).toBe(false)
  })

  it('returns false for null', () => {
    expect(isActionItemArray(null)).toBe(false)
  })

  it('returns false for non-array', () => {
    expect(isActionItemArray({ task: 'x', owner: null, done: false })).toBe(false)
  })

  it('returns false when an item is null', () => {
    expect(isActionItemArray([null])).toBe(false)
  })
})
