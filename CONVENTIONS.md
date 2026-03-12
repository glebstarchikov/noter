# Code Conventions

> Read this file when writing or reviewing any TypeScript, React, Next.js, or API route code.

---

## Code Architecture & Quality

- **Always prefer the best architecture**: small composable modules, single responsibility, clean abstractions. Avoid monolithic components or functions.
- **Prefer explicit over clever**: clear naming, obvious data flow, no magic side effects.
- Use existing utilities and abstractions before inventing new ones; check `lib/` first.
- Keep business logic in `lib/`, UI state in components, server logic in API routes.

---

## TypeScript

- Strict mode. Explicit types for public interfaces and API payloads. No implicit `any`.
- Use `@/` path aliases — no deep relative imports (`@/lib/types`, `@/components/ui/button`).
- Match existing code style (quotes, semicolons, formatting) in every file you touch.

---

## Styling

- **Tailwind CSS v4** — tokens in `app/globals.css` via `@theme inline`. **No** `tailwind.config.ts`.
- Colors use **oklch** color space throughout.
- Always use `cn()` from `lib/utils.ts` for conditional or merged class names.
- Semantic tokens only (`bg-card`, `text-foreground`, `border-border`) — never hardcode colors.
- Icons: **lucide-react** only.

See `DESIGN.md` for visual design philosophy and UI principles.

---

## Components

- Mark `'use client'` only where required (event handlers, hooks, browser APIs). Default to server components.
- Reuse `components/ui/*` primitives. Do not re-implement them.
- Notifications: `toast()` from **sonner**.
- Tiptap editor: use `lib/meeting-editor-extensions.ts` for extension config; convert content via `lib/tiptap-converter.ts`.

---

## API Routes

Every API route must:
1. Export `maxDuration` (see Repository Structure in `CLAUDE.md` for per-route values).
2. Authenticate the user with Supabase before any data access.
3. Enforce ownership: `.eq('user_id', user.id)` on every query.
4. Return `{ error: string, code: string }` with proper HTTP status (`400`, `401`, `404`, `429`, `500`).
5. Follow the conditional rate-limiting pattern below.

Use `errorResponse()` from `@/lib/api-helpers`.

---

## Supabase Client Selection

| Context | Import |
|---|---|
| Client component | `@/lib/supabase/client` |
| Server component / API route | `@/lib/supabase/server` |
| Middleware session refresh | `@/lib/supabase/proxy` |
| Admin / privileged ops | `@/lib/supabase/admin` |

Never cross-use server vs. client Supabase clients.

---

## Rate Limiting Pattern

```typescript
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, '10 s') })
    : null

if (ratelimit) {
  const { success } = await ratelimit.limit(user.id)
  if (!success) return errorResponse('Rate limit exceeded', 'RATE_LIMITED', 429)
}
```

Window: `'10 s'` for chat, `'1 m'` for processing triggers.

---

## AI Models

Defined in `lib/ai-models.ts`. Use helpers (`resolveChatModel`, `getChatModelLabel`) — never hardcode model strings in routes.

| Task | Model |
|---|---|
| Transcription | Deepgram (`@deepgram/sdk`) |
| Notes generation | `gpt-4o-mini` (direct OpenAI SDK) |
| Note enhancement | `ENHANCEMENT_MODEL` from `lib/ai-models.ts` |
| Chat (per-meeting / global) | `resolveChatModel()` via AI SDK v6 `streamText` |

**Content truncation safeguards (enforce on every AI call):**
- Per-meeting chat: transcript ≤ 300,000 chars, each source ≤ 50,000 chars
- Global chat: combined context ≤ 100,000 chars
- Notes generation: transcript ≤ 400,000 chars
