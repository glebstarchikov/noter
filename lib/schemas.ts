import { z } from 'zod'

export const generatedNotesSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  detailed_notes: z.string().optional(),
  action_items: z
    .array(
      z.object({
        task: z.string(),
        owner: z.string().nullable().optional(),
        due_date: z.string().nullish(),
        done: z.boolean().optional(),
      })
    )
    .optional(),
  key_decisions: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  follow_ups: z.array(z.string()).optional(),
})
