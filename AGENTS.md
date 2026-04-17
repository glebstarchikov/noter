# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js App Router project using Bun, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

- `app/`: routes, layouts, auth pages, dashboard UI, and API handlers.
- `components/`: reusable UI and feature components; shadcn primitives live in `components/ui/`.
- `hooks/`: client-side React hooks.
- `lib/`: shared business logic, helpers, types, and Supabase clients in `lib/supabase/`.
- `public/`: static assets and icons.
- `styles/`: global styling and UI notes.
- `scripts/`: numbered SQL migrations such as `007_create_note_templates.sql`.

Prefer the `@/` path alias over deep relative imports.

## Build, Test, and Development Commands
- `bun install`: install dependencies.
- `bun dev`: start the local Next.js dev server.
- `bun run build`: create a production build.
- `bun run start`: run the production build locally.
- `bun run lint`: run ESLint across `app`, `components`, `hooks`, and `lib`.
- `bun run typecheck`: run strict TypeScript checks.
- `bun test`: run the Bun test suite once.
- `bun run test:watch`: rerun tests in watch mode during development.

## Coding Style & Naming Conventions
Prefer TypeScript and functional React components. Keep route files in App Router conventions (`page.tsx`, `layout.tsx`, `route.ts`). Use kebab-case for filenames (`transcript-bubble.tsx`) and colocate feature tests when practical.

Follow the surrounding file’s formatting closely. In new TS/TSX files, prefer 2-space indentation, clear prop names, and small focused components. Linting is enforced with `eslint.config.mjs`; no Prettier config is present.

## Design Language
New components must follow the Workspace design language — see **§Design Rules** in `CLAUDE.md`. Key points: sage accent (`--accent`), tinted `bg-card` surfaces (never white-on-white), `rounded-xl` for cards, `rounded-lg` for chips and inputs, `rounded-md` banned except tiny elements, 3-button hierarchy (primary / ghost / destructive — no `outline` or `secondary` variants), `ghost-icon` for toolbar buttons. Dark mode is deferred to post-v1; do not add dark-mode-only styles.

## Testing Guidelines
Tests use `bun:test`, `@testing-library/react`, `@testing-library/jest-dom`, and Happy DOM via `test.setup.ts`. Keep test files named `*.test.ts` or `*.test.tsx`.

- component tests in `components/`
- API route tests next to handlers in `app/api/*`
- pure logic tests in `lib/__tests__/`

Add or update tests for changed user flows, API contracts, and shared helpers. Run `bun test` and `bun run typecheck` before opening a PR.

## Commit & Pull Request Guidelines
Recent history uses short Conventional Commit prefixes such as `feat:` and `refactor:`. Keep commit messages imperative and specific, for example: `feat: add template selection to dashboard`.

PRs should include a clear summary, linked issue when available, screenshots for UI changes, and notes for env or SQL migration updates. Call out Supabase schema changes explicitly.

## Configuration & Data Notes
Copy from `.env.example` and keep secrets in local env files only. Review required keys before testing auth, AI, or transcription. Treat `scripts/` as ordered schema history and add new migrations instead of editing older ones.
