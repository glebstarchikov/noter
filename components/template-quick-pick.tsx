'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
      <SheetContent side="bottom" className="rounded-t-[28px] pb-8">
        <SheetHeader className="mb-4 gap-2">
          <SheetTitle className="text-base font-semibold">Choose a template</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Pick the note shape you want before you start capturing the conversation.
          </p>
        </SheetHeader>

        <RadioGroup
          value={selectedId}
          onValueChange={setSelectedId}
          className="gap-2"
        >
          {BUILTIN_TEMPLATES.map((template: NoteTemplate) => {
            const isSelected = selectedId === template.id

            return (
              <label
                key={template.id}
                className={cn(
                  'surface-utility flex cursor-pointer items-start gap-3 rounded-[22px] px-4 py-4 transition-colors',
                  isSelected && 'border-foreground/15 bg-secondary/80'
                )}
              >
                <RadioGroupItem
                  value={template.id}
                  aria-label={template.name}
                  className="mt-1"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {template.name}
                    </span>
                    {isSelected ? (
                      <Badge variant="secondary">Selected</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {template.description}
                  </p>
                </div>
              </label>
            )
          })}
        </RadioGroup>

        <Link
          href="/dashboard/templates"
          className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onOpenChange(false)}
        >
          Browse all formats <ChevronRight className="size-3" />
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
