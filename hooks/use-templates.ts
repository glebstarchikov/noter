'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ResolvedNoteTemplate } from '@/lib/note-template'
import type { CreateTemplateInput, UpdateTemplateInput } from '@/lib/templates/template-schemas'

interface UseTemplatesReturn {
  templates: ResolvedNoteTemplate[]
  defaultTemplateId: string
  isLoading: boolean
  error: string | null
  createTemplate: (input: CreateTemplateInput) => Promise<ResolvedNoteTemplate>
  updateTemplate: (id: string, input: UpdateTemplateInput) => Promise<ResolvedNoteTemplate>
  deleteTemplate: (id: string) => Promise<void>
  setDefault: (id: string) => Promise<void>
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<ResolvedNoteTemplate[]>([])
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('builtin-general')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/templates', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load templates')
        const body = await res.json()
        if (!cancelled) {
          setTemplates(body.templates)
          setDefaultTemplateId(body.defaultTemplateId)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const createTemplate = useCallback(async (input: CreateTemplateInput) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error('Failed to create template')
    const created: ResolvedNoteTemplate = await res.json()
    setTemplates((prev) => [...prev, created])
    return created
  }, [])

  const updateTemplate = useCallback(async (id: string, input: UpdateTemplateInput) => {
    const res = await fetch(`/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error('Failed to update template')
    const updated: ResolvedNoteTemplate = await res.json()
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete template')
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    setDefaultTemplateId((prev) => (prev === id ? 'builtin-general' : prev))
  }, [])

  const setDefault = useCallback(async (id: string) => {
    const res = await fetch('/api/user-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_template_id: id }),
    })
    if (!res.ok) throw new Error('Failed to set default template')
    setDefaultTemplateId(id)
  }, [])

  return {
    templates,
    defaultTemplateId,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefault,
  }
}
