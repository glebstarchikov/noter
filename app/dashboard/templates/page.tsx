'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTemplates } from '@/hooks/use-templates'
import { TemplatesList } from '@/components/templates/templates-list'

export default function TemplatesPage() {
  const { templates, defaultTemplateId, isLoading, setDefault, deleteTemplate } = useTemplates()

  return (
    <div className="mx-auto max-w-[960px] px-6 py-10">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-[22px] tracking-tight" style={{ fontWeight: 650 }}>Templates</h1>
        <Link
          href="/dashboard/templates/new"
          className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-[12px] font-medium hover:opacity-90 inline-flex items-center gap-1.5"
        >
          <Plus className="size-3.5" />
          New template
        </Link>
      </div>
      <p className="text-[13px] text-muted-foreground mb-8 max-w-[560px]">
        Templates shape how AI writes your notes — what sections appear, what tone is used, what to capture.
        Pick one as your default. Built-ins are read-only; custom templates are fully editable.
      </p>

      {isLoading ? (
        <div className="text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <TemplatesList
          templates={templates}
          defaultTemplateId={defaultTemplateId}
          onSetDefault={setDefault}
          onDelete={deleteTemplate}
        />
      )}
    </div>
  )
}
