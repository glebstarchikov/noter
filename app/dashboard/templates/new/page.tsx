'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateEditorForm } from '@/components/templates/template-editor-form'
import { useTemplates } from '@/hooks/use-templates'

export default function NewTemplatePage() {
  const router = useRouter()
  const { createTemplate } = useTemplates()

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="text-[22px] tracking-tight mb-1" style={{ fontWeight: 650 }}>New template</h1>
      <p className="text-[13px] text-muted-foreground mb-8">
        Custom templates apply your own structure and tone to AI-generated notes.
      </p>
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
    </div>
  )
}
