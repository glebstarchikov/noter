'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateEditorForm } from '@/components/templates/template-editor-form'
import { useTemplates } from '@/hooks/use-templates'

export default function EditTemplatePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params)
  const router = useRouter()
  const { templates, isLoading, updateTemplate } = useTemplates()

  if (isLoading) {
    return <div className="mx-auto max-w-[720px] px-6 py-10 text-[13px] text-muted-foreground">Loading…</div>
  }

  const template = templates.find((t) => t.id === id)

  if (!template || template.isBuiltin) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-10">
        <p className="text-[13px] text-muted-foreground">Template not found or read-only.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="text-[22px] tracking-tight mb-8" style={{ fontWeight: 650 }}>Edit template</h1>
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
    </div>
  )
}
