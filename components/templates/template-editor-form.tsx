'use client'

import { useState } from 'react'
import { createTemplateSchema, type CreateTemplateInput } from '@/lib/templates/template-schemas'

interface TemplateEditorFormProps {
  onSubmit: (input: CreateTemplateInput) => void
  onCancel: () => void
  initial?: Partial<CreateTemplateInput>
  submitLabel?: string
}

export function TemplateEditorForm({ onSubmit, onCancel, initial, submitLabel = 'Save template' }: TemplateEditorFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [prompt, setPrompt] = useState(initial?.prompt ?? '')

  const payload = {
    name: name.trim(),
    description: description.trim() || undefined,
    prompt: prompt.trim(),
  }
  const parse = createTemplateSchema.safeParse(payload)
  const canSubmit = parse.success

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit(parse.data)
      }}
      className="space-y-6"
    >
      <Field
        label="Name"
        hint="Shown in the picker at generation time"
        counter={`${name.length} / 60`}
      >
        <input
          type="text"
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Sales discovery call"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        />
      </Field>

      <Field
        label="Description (optional)"
        hint="1-line hint shown in the picker"
        counter={`${description.length} / 200`}
      >
        <input
          type="text"
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="e.g. Discovery calls with qualified leads"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        />
      </Field>

      <Field
        label="Prompt"
        hint="This instruction layers on top of the base note generation prompt."
        counter={`${prompt.length} chars`}
      >
        <textarea
          aria-label="Prompt"
          rows={14}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={10_000}
          placeholder="Describe how the AI should shape the output…"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13px] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-[13px] font-medium hover:bg-card">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function Field({ label, hint, counter, children }: { label: string; hint: string; counter: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium mb-1.5">{label}</label>
      {children}
      <div className="flex justify-between mt-1">
        <div className="text-[11px] text-muted-foreground">{hint}</div>
        <div className="text-[11px] text-muted-foreground tabular-nums">{counter}</div>
      </div>
    </div>
  )
}
