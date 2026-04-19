import { describe, test, expect, mock } from 'bun:test'
import {
  BUILTIN_TEMPLATES,
  FALLBACK_TEMPLATE_ID,
  resolveTemplate,
} from '@/lib/note-template'

function makeSupabaseMock(row: { id: string; name: string; description: string | null; prompt: string } | null) {
  const maybeSingle = mock(async () => ({ data: row }))
  const eqUser = mock(() => ({ maybeSingle }))
  const eqId = mock(() => ({ eq: eqUser }))
  const select = mock(() => ({ eq: eqId }))
  const from = mock(() => ({ select }))
  return { from } as unknown as Parameters<typeof resolveTemplate>[2]
}

describe('BUILTIN_TEMPLATES', () => {
  test('has all five expected built-in ids', () => {
    expect(Object.keys(BUILTIN_TEMPLATES).sort()).toEqual([
      'builtin-1on1',
      'builtin-general',
      'builtin-interview',
      'builtin-lecture',
      'builtin-team',
    ])
  })

  test('every built-in is marked isBuiltin and has non-empty prompt', () => {
    for (const tpl of Object.values(BUILTIN_TEMPLATES)) {
      expect(tpl.isBuiltin).toBe(true)
      expect(tpl.prompt.trim().length).toBeGreaterThan(40)
      expect(tpl.name.length).toBeGreaterThan(0)
    }
  })

  test('FALLBACK_TEMPLATE_ID points to an existing built-in', () => {
    expect(BUILTIN_TEMPLATES[FALLBACK_TEMPLATE_ID]).toBeDefined()
  })
})

describe('resolveTemplate', () => {
  test('returns built-in directly when id starts with "builtin-"', async () => {
    const supabase = makeSupabaseMock(null)
    const result = await resolveTemplate('builtin-1on1', 'user-1', supabase)
    expect(result.id).toBe('builtin-1on1')
    expect(result.isBuiltin).toBe(true)
  })

  test('falls back to general for unknown builtin id', async () => {
    const supabase = makeSupabaseMock(null)
    const result = await resolveTemplate('builtin-nonsense', 'user-1', supabase)
    expect(result.id).toBe(FALLBACK_TEMPLATE_ID)
  })

  test('fetches custom template from DB when id is a UUID', async () => {
    const supabase = makeSupabaseMock({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Custom One',
      description: 'desc',
      prompt: 'custom prompt body that is long enough to pass validation',
    })
    const result = await resolveTemplate('11111111-1111-1111-1111-111111111111', 'user-1', supabase)
    expect(result.id).toBe('11111111-1111-1111-1111-111111111111')
    expect(result.name).toBe('Custom One')
    expect(result.isBuiltin).toBe(false)
  })

  test('falls back to general when custom UUID is not found', async () => {
    const supabase = makeSupabaseMock(null)
    const result = await resolveTemplate('11111111-1111-1111-1111-111111111111', 'user-1', supabase)
    expect(result.id).toBe(FALLBACK_TEMPLATE_ID)
  })
})
