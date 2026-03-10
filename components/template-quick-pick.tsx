'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_ID } from '@/lib/templates'
import type { NoteTemplate } from '@/lib/types'

interface TemplateQuickPickProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when user confirms a template selection */
  onConfirm: (templateId: string) => void
}

export function TemplateQuickPick({ open, onOpenChange, onConfirm }: TemplateQuickPickProps) {
  const [selectedId, setSelectedId] = useState(DEFAULT_TEMPLATE_ID)

  function handleConfirm() {
    onConfirm(selectedId)
    onOpenChange(false)
  }

  function handleSkip() {
    onConfirm(DEFAULT_TEMPLATE_ID)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base font-semibold">Choose a template</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col divide-y divide-border/60">
          {BUILTIN_TEMPLATES.map((template: NoteTemplate) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedId(template.id)}
              className={cn(
                'flex items-center gap-3 px-1 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                selectedId === template.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {/* Radio indicator */}
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  selectedId === template.id
                    ? 'border-foreground bg-foreground'
                    : 'border-border'
                )}
              >
                {selectedId === template.id && (
                  <span className="size-1.5 rounded-full bg-background" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className={cn(
                  'text-[13px] font-medium leading-tight',
                  selectedId === template.id ? 'text-foreground' : 'text-foreground/80'
                )}>
                  {template.name}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{template.description}</p>
              </div>
            </button>
          ))}
        </div>

        <Link
          href="/dashboard/templates"
          className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onOpenChange(false)}
        >
          More templates <ChevronRight className="size-3" />
        </Link>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Skip
          </Button>
          <Button onClick={handleConfirm}>
            Start recording
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
