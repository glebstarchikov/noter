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
import { cn } from '@/lib/utils'
import { BUILTIN_TEMPLATES } from '@/lib/templates'
import type { CustomNoteTemplate } from '@/lib/types'

interface EditForm {
  name: string
  description: string
  prompt: string
}

const EMPTY_FORM: EditForm = { name: '', description: '', prompt: '' }

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
      const { templates } = await res.json() as { templates: CustomNoteTemplate[] }
      setCustom(templates)
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCustom() }, [fetchCustom])

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (t: CustomNoteTemplate) => {
    setEditingId(t.id)
    setForm({ name: t.name, description: t.description ?? '', prompt: t.prompt })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.prompt.trim()) { toast.error('Prompt is required'); return }
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
      toast.success(editingId ? 'Template updated' : 'Template created')
      setDialogOpen(false)
      await fetchCustom()
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/note-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Template deleted')
      setCustom((prev) => prev.filter((t) => t.id !== id))
    } catch {
      toast.error('Failed to delete template')
    } finally {
      setDeletingId(null)
    }
  }

  const duplicateBuiltin = (t: typeof BUILTIN_TEMPLATES[0]) => {
    setEditingId(null)
    setForm({ name: `${t.name} (copy)`, description: t.description, prompt: t.prompt })
    setDialogOpen(true)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Choose how your meeting notes are structured. Built-in templates are read-only — duplicate them to customise.
        </p>
      </div>

      {/* Built-in templates */}
      <div className="mb-8">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Starter templates
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {BUILTIN_TEMPLATES.map((t) => (
            <div
              key={t.id}
              className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{t.name}</span>
                  {t.description && (
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                  )}
                </div>
                <Lock className="size-3.5 shrink-0 text-muted-foreground/40 mt-0.5" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="self-start px-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => duplicateBuiltin(t)}
              >
                Duplicate &rarr;
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom templates */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Your templates
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={openNew}>
            <Plus className="size-3.5" />
            New template
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : custom.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No custom templates yet.</p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={openNew}>
              <Plus className="size-3.5" />
              Create your first template
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {custom.map((t) => (
              <div
                key={t.id}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card px-6 py-4"
              >
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate">{t.name}</span>
                  {t.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1">{t.description}</span>
                  )}
                </div>
                <div className={cn(
                  'flex items-center gap-1 transition-opacity',
                  'opacity-0 group-hover:opacity-100'
                )}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(t)}
                    aria-label="Edit template"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    aria-label="Delete template"
                  >
                    {deletingId === t.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit template' : 'New template'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-medium">Name</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Board Meeting"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-desc" className="text-xs font-medium">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="One-line summary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-prompt" className="text-xs font-medium">
                Instructions
              </Label>
              <Textarea
                id="tpl-prompt"
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                placeholder="Describe how the AI should structure the notes…"
                className="min-h-[120px] resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Saving…</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
