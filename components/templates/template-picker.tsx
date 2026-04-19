'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Check } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ResolvedNoteTemplate } from '@/lib/note-template'

interface TemplatePickerProps {
  templates: ResolvedNoteTemplate[]
  selectedId: string
  onChange: (id: string) => void
  onConfirm: (id: string) => void
  buttonLabel?: string
  disabled?: boolean
}

export function TemplatePicker({
  templates,
  selectedId,
  onChange,
  onConfirm,
  buttonLabel = 'Create notes with:',
  disabled,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const builtins = templates.filter((t) => t.isBuiltin)
  const custom = templates.filter((t) => !t.isBuiltin)
  const selected = templates.find((t) => t.id === selectedId) ?? builtins[0]

  // Degraded fallback when /api/templates is unreachable. Render a plain
  // pill that fires the action with the canonical built-in id; the server's
  // resolveTemplate() falls back to builtin-general regardless. Better to
  // ship a working button than to hide the only path to AI generation.
  if (!selected) {
    return (
      <button
        type="button"
        onClick={() => onConfirm('builtin-general')}
        disabled={disabled}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        <span>{buttonLabel}</span>
        <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px]">General</span>
      </button>
    )
  }

  return (
    <div className="inline-flex h-8 items-center rounded-full bg-primary text-primary-foreground text-[12px] font-medium">
      <button
        type="button"
        onClick={() => onConfirm(selected.id)}
        disabled={disabled}
        className="inline-flex h-full items-center gap-1.5 rounded-l-full pl-3.5 pr-2 hover:opacity-90 disabled:opacity-60"
      >
        <span>{buttonLabel}</span>
        <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px]">{selected.name}</span>
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label="Choose template"
          className="inline-flex h-full items-center rounded-r-full pr-3 pl-1.5 hover:opacity-90 border-l border-white/15"
        >
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[340px] p-2">
          <GroupLabel>Built-in</GroupLabel>
          {builtins.map((tpl) => (
            <TemplateItem key={tpl.id} template={tpl} selected={tpl.id === selectedId} onChange={onChange} />
          ))}
          {custom.length > 0 ? (
            <>
              <GroupLabel>Your templates</GroupLabel>
              {custom.map((tpl) => (
                <TemplateItem key={tpl.id} template={tpl} selected={tpl.id === selectedId} onChange={onChange} />
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/templates" className="text-[12px] text-accent font-medium">
              Manage templates →
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

function TemplateItem({
  template,
  selected,
  onChange,
}: {
  template: ResolvedNoteTemplate
  selected: boolean
  onChange: (id: string) => void
}) {
  return (
    <DropdownMenuItem
      role="menuitem"
      onSelect={(e) => {
        e.preventDefault()
        onChange(template.id)
      }}
      className={cn(
        'flex items-start justify-between gap-2 px-2 py-1.5 rounded-lg',
        selected && 'bg-accent/10'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className={cn('text-[13px] font-medium', selected ? 'text-accent' : 'text-foreground')}>
          {template.name}
        </div>
        {template.description ? (
          <div className={cn('text-[11.5px] truncate', selected ? 'text-accent/80' : 'text-muted-foreground')}>
            {template.description}
          </div>
        ) : null}
      </div>
      {selected ? <Check className="size-3.5 text-accent shrink-0 mt-0.5" strokeWidth={2.5} /> : null}
    </DropdownMenuItem>
  )
}
