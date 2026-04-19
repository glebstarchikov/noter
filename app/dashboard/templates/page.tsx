'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTemplates } from '@/hooks/use-templates'
import { TemplatesList } from '@/components/templates/templates-list'
import { PageShell, PageHeader } from '@/components/page-shell'

export default function TemplatesPage() {
  const { templates, defaultTemplateId, isLoading, setDefault, deleteTemplate } = useTemplates()

  return (
    <PageShell size="narrow">
      <PageHeader
        title="Templates"
        description="Templates shape how AI writes your notes — what sections appear, what tone is used, what to capture. Pick one as your default. Built-ins are read-only; custom templates are fully editable."
        actions={
          <Link
            href="/dashboard/templates/new"
            className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-[12px] font-medium hover:opacity-90 inline-flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            New template
          </Link>
        }
      />

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
    </PageShell>
  )
}
