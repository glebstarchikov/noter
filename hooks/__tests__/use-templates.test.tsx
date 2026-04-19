import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTemplates } from '@/hooks/use-templates'

const fetchMock = mock()

beforeEach(() => {
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

function mockGetOk(templates: unknown[], defaultTemplateId: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ templates, defaultTemplateId }),
  })
}

describe('useTemplates', () => {
  it('loads templates on mount', async () => {
    mockGetOk(
      [{ id: 'builtin-general', name: 'General', description: '', prompt: 'p', isBuiltin: true }],
      'builtin-general',
    )

    const { result } = renderHook(() => useTemplates())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.templates.length).toBe(1)
    expect(result.current.defaultTemplateId).toBe('builtin-general')
  })

  it('creates a custom template and updates local list', async () => {
    mockGetOk([], 'builtin-general')

    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'uuid-1', name: 'New', description: '', prompt: 'p'.repeat(25), isBuiltin: false }),
    })

    await act(async () => {
      await result.current.createTemplate({ name: 'New', prompt: 'p'.repeat(25) })
    })

    expect(result.current.templates.some((t) => t.id === 'uuid-1')).toBe(true)
  })

  it('calls setDefault endpoint and updates local default', async () => {
    mockGetOk(
      [{ id: 'builtin-general', name: 'General', description: '', prompt: 'p', isBuiltin: true }],
      'builtin-general',
    )

    const { result } = renderHook(() => useTemplates())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ default_template_id: 'builtin-1on1' }),
    })

    await act(async () => {
      await result.current.setDefault('builtin-1on1')
    })

    expect(result.current.defaultTemplateId).toBe('builtin-1on1')
  })
})
