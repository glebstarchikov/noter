'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateEditorForm } from '@/components/templates/template-editor-form'
import { useTemplates } from '@/hooks/use-templates'
import { PageShell, PageHeader } from '@/components/page-shell'

export default function EditTemplatePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params)
  const router = useRouter()
  const { templates, isLoading, updateTemplate } = useTemplates()

  if (isLoading) {
    return (
      <PageShell size="editor">
        <div className="text-[13px] text-muted-foreground">Loading…</div>
      </PageShell>
    )
  }

  const template = templates.find((t) => t.id === id)

  if (!template || template.isBuiltin) {
    return (
      <PageShell size="editor">
        <p className="text-[13px] text-muted-foreground">Template not found or read-only.</p>
      </PageShell>
    )
  }

  return (
    <PageShell size="editor">
      <PageHeader
        eyebrow={
          <Link
            href="/dashboard/templates"
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            ← Templates
          </Link>
        }
        title="Edit template"
      />
      <TemplateEditorForm
        submitLabel="Save changes"
        initial={{
          name: template.name,
          description: template.description,
          prompt: template.prompt,
        }}
        onSubmit={async (input) => {
          try {
            await updateTemplate(id, input)
            toast.success('Template updated')
            router.push('/dashboard/templates')
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update template')
          }
        }}
        onCancel={() => router.push('/dashboard/templates')}
      />
    </PageShell>
  )
}
