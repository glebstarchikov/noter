'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, Trash2, Pencil } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ResolvedNoteTemplate } from '@/lib/note-template'
import { cn } from '@/lib/utils'

interface TemplatesListProps {
  templates: ResolvedNoteTemplate[]
  defaultTemplateId: string
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
}

export function TemplatesList({ templates, defaultTemplateId, onSetDefault, onDelete }: TemplatesListProps) {
  const builtins = templates.filter((t) => t.isBuiltin)
  const custom = templates.filter((t) => !t.isBuiltin)
  const [pendingDelete, setPendingDelete] = useState<ResolvedNoteTemplate | null>(null)

  return (
    <div className="space-y-8">
      <Section title="Built-in">
        {builtins.map((tpl) => (
          <Row
            key={tpl.id}
            template={tpl}
            isDefault={tpl.id === defaultTemplateId}
            onSetDefault={onSetDefault}
          />
        ))}
      </Section>

      <Section title="Your templates">
        {custom.length === 0 ? (
          <EmptyCustom />
        ) : (
          custom.map((tpl) => (
            <Row
              key={tpl.id}
              template={tpl}
              isDefault={tpl.id === defaultTemplateId}
              onSetDefault={onSetDefault}
              onRequestDelete={() => setPendingDelete(tpl)}
            />
          ))
        )}
      </Section>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom template</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="rounded-xl border border-border bg-background overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function Row({
  template,
  isDefault,
  onSetDefault,
  onRequestDelete,
}: {
  template: ResolvedNoteTemplate
  isDefault: boolean
  onSetDefault: (id: string) => void
  onRequestDelete?: () => void
}) {
  return (
    <div
      data-slot="template-row"
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-card/40 transition-colors"
    >
      <button
        type="button"
        onClick={() => !isDefault && onSetDefault(template.id)}
        aria-label={isDefault ? `${template.name} is the default` : `Set ${template.name} as default`}
        className="shrink-0"
      >
        <Star
          data-state={isDefault ? 'default' : 'idle'}
          className={cn(
            'size-[18px] transition-colors',
            isDefault ? 'fill-accent text-accent' : 'text-muted-foreground hover:text-accent'
          )}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-foreground">{template.name}</div>
        {template.description ? (
          <div className="text-[12.5px] text-muted-foreground truncate">{template.description}</div>
        ) : null}
      </div>

      {!template.isBuiltin ? (
        <div className="flex items-center gap-1 text-[12px]">
          <Link
            href={`/dashboard/templates/${template.id}`}
            aria-label={`Edit ${template.name}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card"
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete ${template.name}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-destructive hover:bg-card"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}

function EmptyCustom() {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-[13px] text-muted-foreground mb-3">
        You don&apos;t have any custom templates yet.
      </p>
      <Link
        href="/dashboard/templates/new"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
      >
        Create one from scratch →
      </Link>
    </div>
  )
}
