import { z } from 'zod'

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional(),
  prompt: z.string().trim().min(20).max(10_000),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export const setDefaultSchema = z.object({
  default_template_id: z.string().trim().min(1),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
