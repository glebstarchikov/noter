import type { ZodSchema, z } from 'zod'
import { errorResponse } from '@/lib/api/api-helpers'

/**
 * Parse and validate a request body against a Zod schema.
 *
 * On success, returns `{ data }` with the typed parsed value (`z.infer<T>`).
 * On failure, returns a 400 Response that can be returned directly from the
 * route handler. Both failure paths use the unified `INVALID_INPUT` error code.
 *
 * **Recommended call-site pattern** (used consistently across the codebase):
 *
 *   const validated = await validateBody(request, schema)
 *   if (validated instanceof Response) return validated
 *   const { data: body } = validated
 *   // body is now typed as z.infer<typeof schema>
 *
 * Known limitation: type inference may lose specificity on schemas wrapped
 * with `.transform()` or `.superRefine()`. In practice this is rare — most
 * routes use plain `z.object(...)` schemas.
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
