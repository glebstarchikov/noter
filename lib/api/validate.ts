import type { ZodSchema, z } from 'zod'
import { errorResponse } from '@/lib/api/api-helpers'

/**
 * Parse and validate a request body against a Zod schema.
 *
 * On success, returns `{ data }` with the typed parsed value.
 * On failure, returns a 400 Response that can be returned directly from the route handler.
 *
 * Usage:
 *   const validated = await validateBody(request, schema)
 *   if (validated instanceof Response) return validated
 *   const { data } = validated
 */
export async function validateBody<T extends ZodSchema>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | Response> {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return errorResponse('Request body must be valid JSON', 'INVALID_INPUT', 400)
  }

  const parsed = schema.safeParse(rawBody)
  if (!parsed.success) {
    return errorResponse(
      'Invalid request body',
      'INVALID_INPUT',
      400,
    )
  }

  return { data: parsed.data }
}
