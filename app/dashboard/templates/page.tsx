'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader, PageShell } from '@/components/page-shell'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { BUILTIN_TEMPLATES } from '@/lib/templates'
import type { CustomNoteTemplate } from '@/lib/types'

interface EditForm {
  name: string
  description: string
  prompt: string
}

const EMPTY_FORM: EditForm = { name: '', description: '', prompt: '' }

function FormatCard({
  title,
  description,
  badge,
  children,
}: {
  title: string
  description?: string | null
  badge: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="surface-document flex h-full flex-col gap-5 px-6 py-6">
      <div className="flex flex-col gap-3">
        <div>{badge}</div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export default function TemplatesPage() {
  const [custom, setCustom] = useState<CustomNoteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchCustom = useCallback(async () => {
    try {
      const res = await fetch('/api/note-templates')
      if (!res.ok) throw new Error()
      const { templates } = (await res.json()) as { templates: CustomNoteTemplate[] }
      setCustom(templates)
    } catch {
      toast.error('Failed to load note formats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustom()
  }, [fetchCustom])

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (template: CustomNoteTemplate) => {
    setEditingId(template.id)
    setForm({
      name: template.name,
      description: template.description ?? '',
      prompt: template.prompt,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Format name is required.')
      return
    }

    if (!form.prompt.trim()) {
      setFormError('Instructions are required.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const url = editingId ? `/api/note-templates/${editingId}` : '/api/note-templates'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) throw new Error()

      toast.success(editingId ? 'Format updated' : 'Format created')
      setDialogOpen(false)
      await fetchCustom()
    } catch {
      setFormError('Failed to save this format.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/note-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Format deleted')
      setCustom((prev) => prev.filter((template) => template.id !== id))
    } catch {
      toast.error('Failed to delete this format')
    } finally {
      setDeletingId(null)
    }
  }

  const duplicateBuiltin = (template: typeof BUILTIN_TEMPLATES[0]) => {
    setEditingId(null)
    setForm({
      name: `${template.name} (copy)`,
      description: template.description,
      prompt: template.prompt,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  return (
    <PageShell>
      <PageHeader
        title="Note formats"
        description="Choose the shape you want your notes to take. Start from a built-in format or make one that matches your team."
        actions={
          <Button onClick={openNew}>
            <Plus />
            New format
          </Button>
        }
      />

      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Built in</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Reliable starting points for common meeting types.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {BUILTIN_TEMPLATES.map((template) => (
              <FormatCard
                key={template.id}
                title={template.name}
                description={template.description}
                badge={<Badge variant="secondary"><Lock /> Included with noter</Badge>}
              >
                <Button
                  variant="ghost"
                  onClick={() => duplicateBuiltin(template)}
                  className="px-0 text-sm text-muted-foreground hover:text-foreground"
                >
                  Use as a starting point
                </Button>
              </FormatCard>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Your formats</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Personal formats you can refine for recurring meetings.
            </p>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="surface-document flex flex-col gap-4 px-6 py-6">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-16 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : custom.length === 0 ? (
            <Empty className="surface-empty items-start text-left">
              <EmptyHeader className="items-start text-left">
                <EmptyTitle>No custom formats yet</EmptyTitle>
                <EmptyDescription>
                  When you want notes tailored to a team ritual or client workflow, create a custom format here.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="items-start">
                <Button variant="outline" onClick={openNew} className="shadow-none">
                  <Plus />
                  Create a format
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {custom.map((template) => (
                <FormatCard
                  key={template.id}
                  title={template.name}
                  description={template.description}
                  badge={<Badge variant="outline">Custom format</Badge>}
                >
                  <Button
                    variant="ghost"
                    onClick={() => openEdit(template)}
                    className="px-0 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Pencil />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(template.id)}
                    disabled={deletingId === template.id}
                    className="px-0 text-sm text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === template.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Delete
                  </Button>
                </FormatCard>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit format' : 'Create a format'}</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <FieldGroup>
              <Field data-invalid={formError ? true : undefined}>
                <FieldLabel htmlFor="tpl-name">Format name</FieldLabel>
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="e.g. Client check-in"
                  aria-invalid={formError ? true : undefined}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="tpl-desc">Short description</FieldLabel>
                <Input
                  id="tpl-desc"
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  placeholder="What makes this format useful?"
                />
              </Field>

              <Field data-invalid={formError ? true : undefined}>
                <FieldLabel htmlFor="tpl-prompt">Instructions for noter</FieldLabel>
                <Textarea
                  id="tpl-prompt"
                  value={form.prompt}
                  onChange={(e) => setForm((current) => ({ ...current, prompt: e.target.value }))}
                  placeholder="Describe the sections, tone, and details this format should capture…"
                  className="min-h-[160px] resize-none text-sm"
                  aria-invalid={formError ? true : undefined}
                />
                <FieldDescription>
                  Explain the structure, emphasis, and tone noter should use when shaping the note.
                </FieldDescription>
                {formError ? <FieldError>{formError}</FieldError> : null}
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="shadow-none">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                'Save format'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
