import { describe, test, expect } from 'bun:test'
import {
  createTemplateSchema,
  updateTemplateSchema,
  setDefaultSchema,
} from '@/lib/templates/template-schemas'

describe('createTemplateSchema', () => {
  test('accepts valid input', () => {
    const result = createTemplateSchema.safeParse({
      name: 'Sales discovery',
      description: 'Discovery calls with qualified leads',
      prompt: 'Emphasize pain points and explicit budget mentions.',
    })
    expect(result.success).toBe(true)
  })

  test('rejects empty name', () => {
    const result = createTemplateSchema.safeParse({
      name: '',
      prompt: 'Long enough prompt body here for validation to pass.',
    })
    expect(result.success).toBe(false)
  })

  test('rejects name longer than 60 chars', () => {
    const result = createTemplateSchema.safeParse({
      name: 'x'.repeat(61),
      prompt: 'Long enough prompt body here for validation to pass.',
    })
    expect(result.success).toBe(false)
  })

  test('rejects prompt shorter than 20 chars', () => {
    const result = createTemplateSchema.safeParse({
      name: 'Valid',
      prompt: 'Too short.',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateTemplateSchema', () => {
  test('allows partial updates', () => {
    expect(updateTemplateSchema.safeParse({ name: 'Only name' }).success).toBe(true)
    expect(updateTemplateSchema.safeParse({}).success).toBe(true)
  })

  test('still rejects invalid field values', () => {
    expect(updateTemplateSchema.safeParse({ name: '' }).success).toBe(false)
    expect(updateTemplateSchema.safeParse({ prompt: 'x' }).success).toBe(false)
  })
})

describe('setDefaultSchema', () => {
  test('accepts a non-empty string', () => {
    expect(setDefaultSchema.safeParse({ default_template_id: 'builtin-general' }).success).toBe(true)
  })

  test('rejects empty string', () => {
    expect(setDefaultSchema.safeParse({ default_template_id: '' }).success).toBe(false)
  })
})
