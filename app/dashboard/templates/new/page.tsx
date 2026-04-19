'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateEditorForm } from '@/components/templates/template-editor-form'
import { useTemplates } from '@/hooks/use-templates'
import { PageShell, PageHeader } from '@/components/page-shell'

export default function NewTemplatePage() {
  const router = useRouter()
  const { createTemplate } = useTemplates()

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
        title="New template"
        description="Custom templates apply your own structure and tone to AI-generated notes."
      />
      <TemplateEditorForm
        onSubmit={async (input) => {
          try {
            const created = await createTemplate(input)
            toast.success(`Template "${created.name}" created`)
            router.push('/dashboard/templates')
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to create template')
          }
        }}
        onCancel={() => router.push('/dashboard/templates')}
      />
    </PageShell>
  )
}
