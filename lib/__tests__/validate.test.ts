import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import { validateBody } from '@/lib/api/validate'

const schema = z.object({
  pinned: z.boolean(),
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('validateBody', () => {
  test('returns parsed data when body matches schema', async () => {
    const request = makeRequest({ pinned: true })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Object)
    expect('data' in result && result.data).toEqual({ pinned: true })
  })

  test('returns 400 error Response when body is invalid', async () => {
    const request = makeRequest({ pinned: 'yes' })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(400)
      const body = await result.json()
      expect(body.code).toBe('INVALID_INPUT')
    }
  })

  test('returns 400 when body is not valid JSON', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{',
    })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Response)
    if (result instanceof Response) {
      expect(result.status).toBe(400)
    }
  })

  test('returns 400 when body is empty', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await validateBody(request, schema)
    expect(result).toBeInstanceOf(Response)
  })
})
