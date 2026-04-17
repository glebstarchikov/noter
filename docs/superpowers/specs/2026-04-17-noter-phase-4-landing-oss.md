# Phase 4 — Landing Page + OSS Prep

- **Date**: 2026-04-17
- **Owner**: Gleb (solo, AI Society)
- **Status**: Approved, ready for implementation plan
- **Depends on**: Phase 3.5 (visual consistency pass) — completed

## Summary

Convert the marketing landing page into an OSS project page targeting developers and student org leaders who might self-host. Add README.md, LICENSE, and a self-host guide. No new features — this is the public launch surface.

---

## 1. Landing Page

### 1.1 Navigation

Replace the current nav with an OSS-focused bar:

- **Left**: `noter` wordmark (font-weight 650)
- **Right**: `Sign in` text link (ghost) + `View on GitHub` primary button (filled `bg-primary`, rounded-full, GitHub icon)

Remove: theme toggle, "Sign up for free" button.

### 1.2 Hero — split layout

Two-column grid (text left, screenshot right), `max-w-[1080px]` centered, `py-[72px]`.

**Left column:**
- Badge: sage dot + "Open source · Self-hostable" (11px uppercase, `text-accent`)
- Headline: "AI meeting notes, on your own terms" (36px, weight 650, tracking-tight)
- Subhead: "Record, transcribe, and generate structured notes with AI. Runs on Vercel + Supabase. 10-minute setup." (15px, `text-muted-foreground`)
- Two CTAs: `Try the demo` (primary, links to `/auth/sign-up`) + `Self-host →` (ghost, links to `/docs/self-host`)

**Right column:**
- `bg-card border border-border rounded-[16px]` container, fixed height ~320px
- Static screenshot of the meeting detail page (`done` state, notes visible)
- Take the screenshot after this phase ships; use a placeholder `aspect-video bg-card` div until then

### 1.3 Value props — 3 cards

Section label: "Why noter" (11px uppercase, `text-accent`)
Section title: "Everything you need, nothing you don't"

Three `bg-card border border-border rounded-[14px]` cards in a 3-column grid:

| Icon | Title | Body |
|------|-------|------|
| 🎙 | Real-time transcription | Deepgram-powered live transcript as you speak, with speaker diarization out of the box. |
| ✨ | AI-generated notes | One click turns your transcript into structured notes with action items, summaries, and key decisions. |
| 🔒 | Fully self-hostable | Your meetings stay on your infrastructure. Deploy to Vercel with your own Supabase project in minutes. |

### 1.4 How it works — 3 numbered steps

Section label: "How it works"
Section title: "From recording to notes in three steps"

Three-column grid, each step: numbered circle (`bg-primary text-primary-foreground`, 28px), bold title, body copy.

| # | Title | Body |
|---|-------|------|
| 1 | Record your meeting | Hit Record — noter captures your mic (and optionally system audio) with a live scrolling transcript alongside. |
| 2 | Review the transcript | The full diarized transcript is saved automatically. Open it any time to check what was said and by whom. |
| 3 | Generate your notes | Click "Create notes" when you're ready. AI turns the transcript into structured, editable notes — you stay in control. |

### 1.5 Self-host teaser — callout banner

`bg-card border border-border rounded-[16px]` banner, two columns: copy left, code + link right.

- **Left**: heading "Run it yourself", subtext "Fork the repo, add your API keys, and deploy. Vercel + Supabase — no custom infrastructure needed."
- **Right**: monospace code block `git clone github.com/[org]/noter` + "Read the self-host guide →" link to `/docs/self-host`

### 1.6 Footer

Single row, `border-t border-border`, `py-7`:

- **Left**: `noter` wordmark + "© 2026 · Focus on the meeting"
- **Right**: MIT License badge + GitHub link + "Made for AI Society" link

### 1.7 What to delete from the current landing

Remove these existing components (they're pure marketing content with no place on the OSS page):
- `components/landing/landing-hero.tsx`
- `components/landing/landing-features.tsx`
- `components/landing/landing-workflow.tsx`
- `components/landing/landing-cta.tsx`

Replace `app/page.tsx` entirely with the new page built from inline sections or new focused components.

---

## 2. README.md

Root-level `README.md` targeting developers. Sections:

1. **Header**: noter logo/name + one-line description + badges (MIT, Vercel deploy button)
2. **What it does**: 3-bullet feature summary
3. **Tech stack**: Next.js 16, Supabase, Deepgram, OpenAI/Claude, Tiptap, Tailwind v4
4. **Self-host quickstart**: 5 numbered steps (clone → env vars → Supabase setup → deploy → done)
5. **Development**: `bun install` + `bun dev` + test/lint commands
6. **Contributing**: brief note pointing to issues
7. **License**: MIT

---

## 3. LICENSE

MIT license file at repo root. Copyright `2026 Gleb Starcikov`.

---

## 4. Self-host guide — `/docs/self-host`

New route at `app/docs/self-host/page.tsx`. Static page (no auth required) with:

1. **Prerequisites**: Node 18+, Bun, Supabase account, Vercel account, API keys (Deepgram, OpenAI or Anthropic)
2. **Step-by-step**:
   - Fork + clone the repo
   - Copy `.env.example` → `.env.local`, fill in keys
   - Run Supabase migrations (`scripts/001_*.sql` through latest)
   - `bun dev` to verify locally
   - Deploy to Vercel (env vars, build settings)
3. **Environment variable reference**: table of all vars, required vs optional, where to get them
4. **Troubleshooting**: 3-4 common issues (Supabase RLS, Deepgram key, CORS)

Style: plain prose, uses existing Workspace tokens, `max-w-[720px]` centered, no sidebar.

---

## 5. Acceptance Criteria

- [ ] `/` renders new OSS landing page with all 4 sections
- [ ] Nav shows GitHub CTA, no "Sign up for free"
- [ ] Old landing components deleted
- [ ] `README.md` exists at repo root with quickstart
- [ ] `LICENSE` exists at repo root (MIT)
- [ ] `/docs/self-host` renders self-host guide, no auth required
- [ ] `bun run typecheck && bun run lint` pass clean
