# Project Overview

**easy-noter** is a modern Next.js 16 application built with React 19, designed for AI-assisted note-taking, meeting transcription, and document processing. The application leverages a rich text editor and integrates with various AI services for audio transcription and text generation.

## Key Technologies

- **Framework:** Next.js 16 (App Router)
- **UI & Styling:** Tailwind CSS v4, shadcn/ui, Radix UI primitives
- **Package Manager & Runtime:** Bun
- **Database & Auth:** Supabase (using `@supabase/ssr` and `@supabase/supabase-js`)
- **AI & Processing:** Vercel AI SDK, OpenAI, Deepgram (for audio transcription)
- **Editor:** Tiptap (Rich Text Editor)
- **Testing:** Bun's native test runner (`bun test`), React Testing Library

## Directory Structure

- `app/`: Next.js App Router containing pages, layouts, and API routes (`api/chat`, `api/transcribe`, `api/meetings`, etc.).
- `components/`: Reusable UI components. Includes shadcn/ui components in `components/ui/`.
- `hooks/`: Custom React hooks, notably for audio recording, deepgram transcription, and editor autosave.
- `lib/`: Core utilities, AI prompts, Supabase configuration, Zod schemas, and various helper functions.
- `scripts/`: SQL scripts for setting up the Supabase database schema (meetings, sources, templates, etc.).
- `styles/`: Global stylesheets and UI interaction guidelines.

## Building and Running

The project relies on Bun as its package manager and runtime.

- **Development Server:**
  ```bash
  bun run dev
  ```
- **Production Build:**
  ```bash
  bun run build
  bun run start
  ```
- **Type Checking:**
  ```bash
  bun run typecheck
  ```
- **Linting:**
  ```bash
  bun run lint
  ```
- **Testing:**
  ```bash
  bun run test
  # For watch mode:
  bun run test:watch
  ```

## Development Conventions

- **Component Architecture:** Heavily relies on shadcn/ui and Radix UI primitives for accessible, customizable components. Use the `components/ui/` directory for base components.
- **Data Fetching & APIs:** Uses Next.js API Routes for backend functionality (transcription, OpenAI integrations).
- **State Management & Hooks:** Custom hooks in `hooks/` encapsulate complex logic like audio processing and real-time state.
- **Testing:** The project includes `__tests__` directories and `.test.ts`/`.test.tsx` files. Ensure you add/update tests when modifying core logic or components using `bun test`.
- **Typing:** Strict TypeScript typing is enforced. Run `bun run typecheck` to validate type correctness before committing.
