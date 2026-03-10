'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  meta,
  children,
}: {
  title: string
  description?: string | null
  meta: string
  children: React.ReactNode
}) {
  return (
    <div className="surface-document flex h-full flex-col gap-4 px-6 py-6">
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">{meta}</span>
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const [custom, setCustom] = useState<CustomNoteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)
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
    setDialogOpen(true)
  }

  const openEdit = (template: CustomNoteTemplate) => {
    setEditingId(template.id)
    setForm({
      name: template.name,
      description: template.description ?? '',
      prompt: template.prompt,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.prompt.trim()) {
      toast.error('Instructions are required')
      return
    }

    setSaving(true)
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
      toast.error('Failed to save this format')
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
    setDialogOpen(true)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 md:py-12">
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-[30px] font-semibold tracking-tight text-foreground">Note formats</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose the shape you want your notes to take. Start from a built-in format, or make one that matches your team.
          </p>
        </div>
        <Button onClick={openNew} className="self-start">
          <Plus className="size-4" />
          New format
        </Button>
      </div>

      <div className="space-y-10">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Built in</h2>
            <p className="text-sm text-muted-foreground">
              Reliable starting points for common meeting types.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {BUILTIN_TEMPLATES.map((template) => (
              <FormatCard
                key={template.id}
                title={template.name}
                description={template.description}
                meta="Included with noter"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                  <Lock className="size-3.5" />
                  Read only
                </div>
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

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Your formats</h2>
            <p className="text-sm text-muted-foreground">
              Personal formats you can refine for recurring meetings.
            </p>
          </div>

          {loading ? (
            <div className="surface-utility flex items-center gap-3 px-5 py-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading your formats…
            </div>
          ) : custom.length === 0 ? (
            <div className="surface-utility flex flex-col items-start gap-4 px-6 py-8">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">No custom formats yet</p>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  When you want notes tailored to a team ritual or client workflow, create a custom format here.
                </p>
              </div>
              <Button variant="outline" onClick={openNew} className="shadow-none">
                <Plus className="size-4" />
                Create a format
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {custom.map((template) => (
                <FormatCard
                  key={template.id}
                  title={template.name}
                  description={template.description}
                  meta="Custom format"
                >
                  <Button
                    variant="ghost"
                    onClick={() => openEdit(template)}
                    className="px-0 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(template.id)}
                    disabled={deletingId === template.id}
                    className="px-0 text-sm text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === template.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
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

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-medium">
                Format name
              </Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g. Client check-in"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-desc" className="text-xs font-medium">
                Short description
              </Label>
              <Input
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                placeholder="What makes this format useful?"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-prompt" className="text-xs font-medium">
                Instructions for noter
              </Label>
              <Textarea
                id="tpl-prompt"
                value={form.prompt}
                onChange={(e) => setForm((current) => ({ ...current, prompt: e.target.value }))}
                placeholder="Describe the sections, tone, and details this format should capture…"
                className="min-h-[160px] resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="shadow-none">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save format'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
