# Contributing to noter

Thanks for considering a contribution! noter is a small project — every issue and PR helps.

## Quick start

```bash
git clone https://github.com/glebstarchikov/noter && cd noter
bun install
cp .env.example .env.local         # fill in your keys
bun dev                            # http://localhost:3000
```

You'll need a Supabase project (free tier works) and an OpenAI API key. Deepgram is optional (live transcription); without it, you can still upload audio files. See [docs/self-host](/docs/self-host) for the full env-var reference.

## Before opening a PR

Run all of these and confirm they pass:

```bash
bun run typecheck
bun run lint
bun test
```

If you change a UI component, also run `bun dev` and visually verify the change at desktop + phone widths.

## Conventions

### Commits — Conventional Commits with scope

```
feat(templates): add custom template editor
fix(enhance): preserve user content when draft is substantial
refactor(page-shell): add editor variant
docs: update self-host guide
chore: bump dependencies
```

Scope is optional but encouraged. Past commit history shows the style.

### File naming

- TypeScript files: `kebab-case.ts` / `kebab-case.tsx`
- Test files: co-located as `*.test.ts` / `*.test.tsx`
- Pure-logic tests live in `lib/__tests__/`

### Path imports

Use the `@/` alias:

```ts
import { PageShell } from '@/components/page-shell'
import { resolveTemplate } from '@/lib/note-template'
```

### API routes

- Validate request bodies with `validateBody(request, schema)` from `@/lib/api/validate`
- Return errors via `errorResponse(message, code, status)` from `@/lib/api/api-helpers`
- Route exceptions through `Sentry.captureException(error, { tags: { route: '...' } })`
- No bare `console.error` in `app/api/**`

### Database

- All tables have Row-Level Security (RLS); never use the service-role client in user-facing routes
- Migrations are append-only — never modify existing files in `scripts/`
- New migrations: numbered sequentially (next is `012_*.sql`)

### Design language

The app uses the **Workspace** design rules. Key constraints:

- Sage accent (`--accent`) for active/positive states; terracotta (`--destructive`) only for errors
- A separate `--recording` token for live-recording UI (not the brand accent)
- `Inter` only, weights 400/500/550/650 (NOT `font-semibold` which is 600)
- `rounded-xl` (14px) for cards, `rounded-lg` (10px) for chips
- Tinted card surface (`bg-card`) — never white-on-white
- Use `PageShell` + `PageHeader` for page layout (don't hardcode `max-w-*`)

Full design rules in [CLAUDE.md](CLAUDE.md) under "Design Rules — Workspace Language".

## Testing

- `bun test` runs all tests with the Bun test runner + Happy DOM
- Use `@testing-library/react` for component tests with `afterEach(cleanup)` to prevent DOM pollution
- Mock external dependencies (`mock.module('@/lib/supabase/server', ...)`) — see existing route tests for the pattern

## Reporting bugs

Open an issue using the **bug report** template. Include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser + OS
- Anything from the console / Sentry

## Suggesting features

Open an issue using the **feature request** template. The smaller and more concrete, the better. For larger features, sketch the user-visible behavior first — implementation discussion can come after.

## Security issues

**Don't open a public issue for vulnerabilities.** See [SECURITY.md](SECURITY.md).

## Code of Conduct

Be kind. Be specific. Assume good intent. We don't have a formal Code of Conduct yet because the community is small — that'll come if/when it's needed.

## License

By contributing, you agree your contributions are licensed under the MIT License (same as the project).
