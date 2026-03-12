# Testing

> Read this file when writing or updating tests.

---

## Structure

- API route tests are **colocated**: `app/api/*/route.test.ts`.
- Component tests are **colocated**: `components/*.test.tsx`.
- Lib utility tests live in `lib/__tests__/`.

## Setup

- `test.setup.ts` mocks `next/server` and sets env vars (preloaded via `bunfig.toml`).
- `happydom.ts` provides DOM globals.

## Patterns

- Use `mock.module()` and `mock()` from `bun:test`.
- Standard mock targets: `@/lib/supabase/server`, `@/lib/openai`, `ai`, `@ai-sdk/openai`, `@upstash/ratelimit`, `@upstash/redis`.
- When changing API or component behavior, add or update the colocated test file.

## Commands

```bash
bun run test          # Run all tests once
bun run test:watch    # Watch mode
```

Always run `bun run lint` and `bun run test` before marking a task complete.
