import { describe, it, expect } from 'bun:test'
import { resolveMeetingTemplate, formatTemplateContext } from '../note-template'
import { DEFAULT_TEMPLATE_ID, getBuiltinTemplate } from '../templates'

function mockSupabase(templateData: unknown = null, error: { message: string } | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: templateData, error }),
          }),
        }),
      }),
    }),
  }
}

describe('resolveMeetingTemplate', () => {
  it('returns default template when template_id is null', async () => {
    const result = await resolveMeetingTemplate(mockSupabase(), {
      template_id: null,
      user_id: 'user-1',
    })
    expect(result.id).toBe(DEFAULT_TEMPLATE_ID)
    expect(result.isBuiltin).toBe(true)
  })

  it('returns builtin template when template_id matches', async () => {
    const result = await resolveMeetingTemplate(mockSupabase(), {
      template_id: 'sales-call',
      user_id: 'user-1',
    })
    expect(result.id).toBe('sales-call')
    expect(result.name).toBe('Sales Call')
    expect(result.isBuiltin).toBe(true)
  })

  it('fetches custom template from database', async () => {
    const customTemplate = {
      id: 'custom-1',
      name: 'My Template',
      description: 'Custom description',
      prompt: 'Custom prompt',
    }
    const result = await resolveMeetingTemplate(mockSupabase(customTemplate), {
      template_id: 'custom-1',
      user_id: 'user-1',
    })
    expect(result.id).toBe('custom-1')
    expect(result.name).toBe('My Template')
    expect(result.isBuiltin).toBe(false)
  })

  it('falls back to default template when custom template not found', async () => {
    const result = await resolveMeetingTemplate(mockSupabase(null), {
      template_id: 'nonexistent',
      user_id: 'user-1',
    })
    expect(result.id).toBe(DEFAULT_TEMPLATE_ID)
    expect(result.isBuiltin).toBe(true)
  })

  it('throws when database query fails', async () => {
    await expect(
      resolveMeetingTemplate(mockSupabase(null, { message: 'DB error' }), {
        template_id: 'custom-1',
        user_id: 'user-1',
      })
    ).rejects.toThrow('Failed to load note template: DB error')
  })

  it('returns empty description when custom template description is null', async () => {
    const customTemplate = {
      id: 'custom-2',
      name: 'Minimal',
      description: null,
      prompt: 'Some prompt',
    }
    const result = await resolveMeetingTemplate(mockSupabase(customTemplate), {
      template_id: 'custom-2',
      user_id: 'user-1',
    })
    expect(result.description).toBe('')
  })
})

describe('formatTemplateContext', () => {
  it('includes template name and prompt', () => {
    const template = getBuiltinTemplate('general')!
    const result = formatTemplateContext({
      id: template.id,
      name: template.name,
      description: template.description,
      prompt: template.prompt,
      isBuiltin: true,
    })
    expect(result).toContain('Selected note format: General Meeting')
    expect(result).toContain('Format instructions:')
    expect(result).toContain(template.prompt)
  })

  it('includes description when present', () => {
    const result = formatTemplateContext({
      id: 'test',
      name: 'Test',
      description: 'A test template',
      prompt: 'Do things',
      isBuiltin: false,
    })
    expect(result).toContain('Description: A test template')
  })

  it('omits description when empty', () => {
    const result = formatTemplateContext({
      id: 'test',
      name: 'Test',
      description: '',
      prompt: 'Do things',
      isBuiltin: false,
    })
    expect(result).not.toContain('Description:')
  })
})
