# Phase 4 — Landing Page + OSS Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the marketing landing page with an OSS-focused page, add README.md, LICENSE, and a `/docs/self-host` guide to prepare for public open-source release.

**Architecture:** New server-component landing page (`app/page.tsx`, no `'use client'`) composed from focused section components in `components/landing/`. The `/docs/self-host` route is a static server page, publicly accessible (middleware only guards `/dashboard`). README and LICENSE live at the repo root.

**Tech Stack:** Next.js 16 App Router (server components), Tailwind CSS v4 with Workspace design tokens, lucide-react icons

---

## File Map

**Create:**
- `components/landing/landing-nav.tsx` — sticky top nav: wordmark + Sign in + GitHub CTA
- `components/landing/landing-hero.tsx` — two-column grid hero (text left, screenshot placeholder right)
- `components/landing/landing-value-props.tsx` — "Why noter" 3-card section
- `components/landing/landing-how-it-works.tsx` — 3-step numbered section
- `components/landing/landing-self-host.tsx` — self-host teaser banner
- `components/landing/landing-footer.tsx` — footer with MIT badge + GitHub link
- `app/docs/self-host/page.tsx` — static self-host guide (no auth required)
- `README.md` — root-level developer README
- `LICENSE` — MIT license

**Replace entirely:**
- `app/page.tsx` — new server-component page shell (delete old scroll-state `'use client'` version)

**Delete:**
- `components/landing-hero.tsx`
- `components/landing-features.tsx`
- `components/landing-workflow.tsx`
- `components/landing-cta.tsx`

---

## Task 1: Delete old landing components + create bare page shell

**Files:**
- Delete: `components/landing-hero.tsx`, `components/landing-features.tsx`, `components/landing-workflow.tsx`, `components/landing-cta.tsx`
- Replace: `app/page.tsx`

- [ ] **Step 1: Delete the four old landing component files**

```bash
rm components/landing-hero.tsx components/landing-features.tsx components/landing-workflow.tsx components/landing-cta.tsx
```

- [ ] **Step 2: Write the new `app/page.tsx` shell**

This version imports nothing from the deleted files. It's a static server component — no `'use client'`, no scroll state.

Replace the entire contents of `app/page.tsx` with:

```tsx
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingValueProps } from '@/components/landing/landing-value-props'
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works'
import { LandingSelfHost } from '@/components/landing/landing-self-host'
import { LandingFooter } from '@/components/landing/landing-footer'

export default function HomePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <div className="mx-auto max-w-[1080px] border-t border-border" />
        <LandingValueProps />
        <div className="mx-auto max-w-[1080px] border-t border-border" />
        <LandingHowItWorks />
        <div className="mx-auto max-w-[1080px] border-t border-border" />
        <LandingSelfHost />
      </main>
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck to confirm the page shell imports are wired**

The build will fail because the component files don't exist yet — that's expected. Verify the error is only "Module not found" for the 6 new components, not any other error.

```bash
bun run typecheck 2>&1 | grep -E "(error|Cannot find)" | head -20
```

Expected: 6 "Cannot find module" errors for `@/components/landing/*`, nothing else.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git rm components/landing-hero.tsx components/landing-features.tsx components/landing-workflow.tsx components/landing-cta.tsx
git commit -m "refactor(landing): delete old marketing components, stub new OSS page shell"
```

---

## Task 2: Nav component

**Files:**
- Create: `components/landing/landing-nav.tsx`

- [ ] **Step 1: Create the file**

```bash
mkdir -p components/landing
```

Create `components/landing/landing-nav.tsx`:

```tsx
import Link from 'next/link'
import { Github } from 'lucide-react'

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-12 py-4">
      <span className="text-[15px] tracking-tight" style={{ fontWeight: 650 }}>
        noter
      </span>
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
        <a
          href="https://github.com/YOUR_ORG/noter"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Github className="size-3.5" />
          View on GitHub
        </a>
      </div>
    </nav>
  )
}
```

> **Note:** Replace `YOUR_ORG` with the actual GitHub username/org before committing (e.g. `glebstar06`).

- [ ] **Step 2: Run typecheck — should be down to 5 "Cannot find module" errors**

```bash
bun run typecheck 2>&1 | grep "Cannot find module" | wc -l
```

Expected output: `5`

- [ ] **Step 3: Commit**

```bash
git add components/landing/landing-nav.tsx
git commit -m "feat(landing): add OSS nav — wordmark + Sign in + GitHub CTA"
```

---

## Task 3: Hero section

**Files:**
- Create: `components/landing/landing-hero.tsx`

- [ ] **Step 1: Create `components/landing/landing-hero.tsx`**

```tsx
import Link from 'next/link'

export function LandingHero() {
  return (
    <section className="mx-auto grid max-w-[1080px] grid-cols-2 items-center gap-12 px-12 py-[72px]">
      {/* Left — text */}
      <div>
        <div className="mb-4 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
            Open source · Self-hostable
          </span>
        </div>
        <h1
          className="mb-3.5 text-[36px] leading-[1.15] tracking-tight text-foreground"
          style={{ fontWeight: 650 }}
        >
          AI meeting notes,
          <br />
          on your own terms
        </h1>
        <p className="mb-7 max-w-[380px] text-[15px] leading-relaxed text-muted-foreground">
          Record, transcribe, and generate structured notes with AI. Runs on
          Vercel + Supabase. 10-minute setup.
        </p>
        <div className="flex items-center gap-2.5">
          <Link
            href="/auth/sign-up"
            className="rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try the demo
          </Link>
          <Link
            href="/docs/self-host"
            className="rounded-full border border-border px-5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
          >
            Self-host →
          </Link>
        </div>
      </div>

      {/* Right — screenshot placeholder */}
      <div className="h-80 rounded-[16px] border border-border bg-card" />
    </section>
  )
}
```

- [ ] **Step 2: Run typecheck — should be down to 4 "Cannot find module" errors**

```bash
bun run typecheck 2>&1 | grep "Cannot find module" | wc -l
```

Expected output: `4`

- [ ] **Step 3: Commit**

```bash
git add components/landing/landing-hero.tsx
git commit -m "feat(landing): add split hero — badge, headline, CTAs, screenshot placeholder"
```

---

## Task 4: Value props + How it works sections

**Files:**
- Create: `components/landing/landing-value-props.tsx`
- Create: `components/landing/landing-how-it-works.tsx`

- [ ] **Step 1: Create `components/landing/landing-value-props.tsx`**

```tsx
const PROPS = [
  {
    icon: '🎙',
    title: 'Real-time transcription',
    body: 'Deepgram-powered live transcript as you speak, with speaker diarization out of the box.',
  },
  {
    icon: '✨',
    title: 'AI-generated notes',
    body: 'One click turns your transcript into structured notes with action items, summaries, and key decisions.',
  },
  {
    icon: '🔒',
    title: 'Fully self-hostable',
    body: 'Your meetings stay on your infrastructure. Deploy to Vercel with your own Supabase project in minutes.',
  },
]

export function LandingValueProps() {
  return (
    <section className="mx-auto max-w-[1080px] px-12 py-16">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
        Why noter
      </p>
      <h2
        className="mb-10 text-[24px] tracking-tight text-foreground"
        style={{ fontWeight: 650 }}
      >
        Everything you need, nothing you don&apos;t
      </h2>
      <div className="grid grid-cols-3 gap-5">
        {PROPS.map((prop) => (
          <div
            key={prop.title}
            className="rounded-[14px] border border-border bg-card p-6"
          >
            <div className="mb-3.5 flex size-8 items-center justify-center rounded-lg border border-border bg-background text-sm">
              {prop.icon}
            </div>
            <h3 className="mb-1.5 text-[14px] font-semibold text-foreground">
              {prop.title}
            </h3>
            <p className="text-[13px] leading-[1.55] text-muted-foreground">
              {prop.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/landing/landing-how-it-works.tsx`**

```tsx
const STEPS = [
  {
    num: 1,
    title: 'Record your meeting',
    body: 'Hit Record — noter captures your mic (and optionally system audio) with a live scrolling transcript alongside.',
  },
  {
    num: 2,
    title: 'Review the transcript',
    body: 'The full diarized transcript is saved automatically. Open it any time to check what was said and by whom.',
  },
  {
    num: 3,
    title: 'Generate your notes',
    body: 'Click "Create notes" when you\'re ready. AI turns the transcript into structured, editable notes — you stay in control.',
  },
]

export function LandingHowItWorks() {
  return (
    <section className="mx-auto max-w-[1080px] px-12 py-16">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
        How it works
      </p>
      <h2
        className="mb-10 text-[24px] tracking-tight text-foreground"
        style={{ fontWeight: 650 }}
      >
        From recording to notes in three steps
      </h2>
      <div className="grid grid-cols-3 gap-6">
        {STEPS.map((step) => (
          <div key={step.num} className="flex flex-col gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {step.num}
            </div>
            <h3 className="text-[14px] font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-[13px] leading-[1.55] text-muted-foreground">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Run typecheck — should be down to 2 "Cannot find module" errors**

```bash
bun run typecheck 2>&1 | grep "Cannot find module" | wc -l
```

Expected output: `2`

- [ ] **Step 4: Commit**

```bash
git add components/landing/landing-value-props.tsx components/landing/landing-how-it-works.tsx
git commit -m "feat(landing): add value props and how-it-works sections"
```

---

## Task 5: Self-host teaser + Footer

**Files:**
- Create: `components/landing/landing-self-host.tsx`
- Create: `components/landing/landing-footer.tsx`

- [ ] **Step 1: Create `components/landing/landing-self-host.tsx`**

```tsx
import Link from 'next/link'

export function LandingSelfHost() {
  return (
    <section className="mx-auto max-w-[1080px] px-12 py-16">
      <div className="flex items-center justify-between gap-8 rounded-[16px] border border-border bg-card px-10 py-9">
        {/* Left */}
        <div>
          <h2
            className="mb-2 text-[20px] tracking-tight text-foreground"
            style={{ fontWeight: 650 }}
          >
            Run it yourself
          </h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Fork the repo, add your API keys, and deploy.
            <br />
            Vercel + Supabase — no custom infrastructure needed.
          </p>
        </div>

        {/* Right */}
        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <code className="whitespace-nowrap rounded-lg bg-foreground px-4 py-2.5 font-mono text-[12px] text-[#a8b4a0]">
            <span className="text-accent">git clone</span>{' '}
            github.com/YOUR_ORG/noter
          </code>
          <Link
            href="/docs/self-host"
            className="flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
          >
            Read the self-host guide →
          </Link>
        </div>
      </div>
    </section>
  )
}
```

> **Note:** Replace `YOUR_ORG` with the actual GitHub username/org.

- [ ] **Step 2: Create `components/landing/landing-footer.tsx`**

```tsx
export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between px-12 py-7">
        <div className="flex items-center gap-4">
          <span className="text-[13px]" style={{ fontWeight: 650 }}>
            noter
          </span>
          <span className="text-[12px] text-muted-foreground">
            © 2026 · Focus on the meeting
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
            MIT License
          </span>
          <a
            href="https://github.com/YOUR_ORG/noter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="#"
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Made for AI Society
          </a>
        </div>
      </div>
    </footer>
  )
}
```

> **Note:** Replace `YOUR_ORG` with the actual GitHub username/org.

- [ ] **Step 3: Run full typecheck — should be clean**

```bash
bun run typecheck
```

Expected: no errors. The page shell and all 6 components are now wired.

- [ ] **Step 4: Run lint**

```bash
bun run lint
```

Expected: no errors or warnings.

- [ ] **Step 5: Start dev server and verify the landing page visually**

```bash
bun dev
```

Open `http://localhost:3000`. Verify:
- Nav: "noter" wordmark left, "Sign in" ghost link + "View on GitHub" filled pill right
- Hero: two-column grid, badge with sage dot, headline, two CTAs, placeholder card right
- "Why noter" section: 3 cards with icons
- "How it works" section: 3 numbered steps
- Self-host banner: code block on right, link on left
- Footer: MIT badge, GitHub link, AI Society link

- [ ] **Step 6: Commit**

```bash
git add components/landing/landing-self-host.tsx components/landing/landing-footer.tsx
git commit -m "feat(landing): add self-host teaser banner and footer"
```

---

## Task 6: Self-host docs page

**Files:**
- Create: `app/docs/self-host/page.tsx`

No auth required — the middleware only gates `/dashboard`, so this route is publicly accessible.

- [ ] **Step 1: Create `app/docs/self-host/page.tsx`**

```tsx
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Self-host noter',
  description: 'Deploy noter on your own infrastructure with Vercel and Supabase.',
}

export default function SelfHostPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-16 text-foreground">
      <Link
        href="/"
        className="mb-8 inline-block text-[13px] text-muted-foreground hover:text-foreground"
      >
        ← Back to noter
      </Link>

      <h1
        className="mb-3 text-[32px] tracking-tight"
        style={{ fontWeight: 650 }}
      >
        Self-host noter
      </h1>
      <p className="mb-12 text-[15px] text-muted-foreground">
        Deploy noter on your own Vercel + Supabase stack. No custom
        infrastructure needed.
      </p>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="mb-4 text-[18px] font-semibold">Prerequisites</h2>
        <ul className="space-y-1.5 text-[14px] text-muted-foreground">
          <li>
            Node.js 18+ and{' '}
            <a
              href="https://bun.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Bun
            </a>
          </li>
          <li>
            A{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Supabase
            </a>{' '}
            account (free tier works)
          </li>
          <li>
            A{' '}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Vercel
            </a>{' '}
            account
          </li>
          <li>
            An{' '}
            <a
              href="https://platform.openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              OpenAI
            </a>{' '}
            API key
          </li>
          <li>
            Optional: A{' '}
            <a
              href="https://deepgram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Deepgram
            </a>{' '}
            API key for real-time transcription
          </li>
        </ul>
      </section>

      {/* Step-by-step */}
      <section className="mb-12">
        <h2 className="mb-6 text-[18px] font-semibold">Step-by-step</h2>
        <ol className="space-y-8 text-[14px]">
          <li>
            <div className="mb-2 font-semibold">1. Fork and clone</div>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>{`git clone https://github.com/YOUR_ORG/noter
cd noter
bun install`}</code>
            </pre>
          </li>
          <li>
            <div className="mb-2 font-semibold">
              2. Set up environment variables
            </div>
            <p className="mb-2 text-muted-foreground">
              Copy the example and fill in your keys:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>cp .env.example .env.local</code>
            </pre>
            <p className="mt-2 text-muted-foreground">
              See the{' '}
              <a href="#env-vars" className="text-accent hover:underline">
                environment variable reference
              </a>{' '}
              below for all required and optional keys.
            </p>
          </li>
          <li>
            <div className="mb-2 font-semibold">3. Run Supabase migrations</div>
            <p className="mb-2 text-muted-foreground">
              In your Supabase dashboard, go to the SQL editor and run each
              migration file in order:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>{`scripts/001_initial.sql  → run first
scripts/002_*.sql
... (run each in ascending order)
scripts/010_drop_note_templates.sql  → run last`}</code>
            </pre>
          </li>
          <li>
            <div className="mb-2 font-semibold">4. Verify locally</div>
            <pre className="overflow-x-auto rounded-xl bg-foreground p-4 font-mono text-[12px] text-[#a8b4a0]">
              <code>bun dev</code>
            </pre>
            <p className="mt-2 text-muted-foreground">
              Open{' '}
              <span className="font-mono text-foreground">
                http://localhost:3000
              </span>
              . Sign up with email — Supabase sends a confirmation link.
            </p>
          </li>
          <li>
            <div className="mb-2 font-semibold">5. Deploy to Vercel</div>
            <p className="text-muted-foreground">
              Push your fork to GitHub, then import it into Vercel. Add all
              environment variables from{' '}
              <span className="font-mono text-foreground">.env.local</span> in
              the Vercel dashboard under{' '}
              <em>Settings → Environment Variables</em>. Framework preset:{' '}
              <strong>Next.js</strong>.
            </p>
          </li>
        </ol>
      </section>

      {/* Env var reference */}
      <section className="mb-12" id="env-vars">
        <h2 className="mb-4 text-[18px] font-semibold">
          Environment variable reference
        </h2>
        <div className="overflow-hidden rounded-xl border border-border text-[13px]">
          <table className="w-full">
            <thead className="bg-card">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Variable</th>
                <th className="px-4 py-3 text-left font-medium">Required</th>
                <th className="px-4 py-3 text-left font-medium">
                  Where to get it
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(
                [
                  [
                    'NEXT_PUBLIC_SUPABASE_URL',
                    'Yes',
                    'Supabase project → Settings → API',
                  ],
                  [
                    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
                    'Yes',
                    'Supabase project → Settings → API',
                  ],
                  ['OPENAI_API_KEY', 'Yes', 'platform.openai.com/api-keys'],
                  [
                    'DEEPGRAM_API_KEY',
                    'For live transcription',
                    'console.deepgram.com',
                  ],
                  [
                    'DEEPGRAM_PROJECT_ID',
                    'For live transcription',
                    'console.deepgram.com → project settings',
                  ],
                  [
                    'UPSTASH_REDIS_REST_URL',
                    'For rate limiting',
                    'console.upstash.com',
                  ],
                  [
                    'UPSTASH_REDIS_REST_TOKEN',
                    'For rate limiting',
                    'console.upstash.com',
                  ],
                  [
                    'NEXT_PUBLIC_SENTRY_DSN',
                    'Optional',
                    'sentry.io → project → settings',
                  ],
                  ['TAVILY_API_KEY', 'Optional', 'app.tavily.com'],
                ] as [string, string, string][]
              ).map(([name, required, where]) => (
                <tr key={name}>
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground">
                    {name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{required}</td>
                  <td className="px-4 py-3 text-muted-foreground">{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Troubleshooting */}
      <section>
        <h2 className="mb-4 text-[18px] font-semibold">Troubleshooting</h2>
        <div className="space-y-6 text-[14px]">
          <div>
            <h3 className="mb-1 font-semibold">
              Auth redirect doesn&apos;t work locally
            </h3>
            <p className="text-muted-foreground">
              Set{' '}
              <span className="font-mono text-foreground">
                NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
              </span>{' '}
              in{' '}
              <span className="font-mono text-foreground">.env.local</span>.
              Also add{' '}
              <span className="font-mono text-foreground">
                http://localhost:3000/**
              </span>{' '}
              to your Supabase project&apos;s allowed redirect URLs.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">
              Supabase RLS blocks all reads
            </h3>
            <p className="text-muted-foreground">
              Make sure you ran all migrations — they include the RLS policies.
              If you created tables manually, verify that{' '}
              <span className="font-mono text-foreground">
                ALTER TABLE ... ENABLE ROW LEVEL SECURITY
              </span>{' '}
              ran and the appropriate{' '}
              <span className="font-mono text-foreground">CREATE POLICY</span>{' '}
              statements exist.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">
              Deepgram transcription doesn&apos;t start
            </h3>
            <p className="text-muted-foreground">
              You need both{' '}
              <span className="font-mono text-foreground">
                DEEPGRAM_API_KEY
              </span>{' '}
              and{' '}
              <span className="font-mono text-foreground">
                DEEPGRAM_PROJECT_ID
              </span>{' '}
              set. Without a project ID, noter falls back to returning the raw
              API key in the browser — insecure in production. Check Vercel
              function logs for the{' '}
              <span className="font-mono text-foreground">
                /api/transcribe/realtime-token
              </span>{' '}
              route.
            </p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">
              CORS errors when calling API routes
            </h3>
            <p className="text-muted-foreground">
              This typically means{' '}
              <span className="font-mono text-foreground">
                NEXT_PUBLIC_SUPABASE_URL
              </span>{' '}
              is wrong, or the Supabase project&apos;s CORS settings don&apos;t
              include your Vercel domain. Go to Supabase → Settings → API and
              add your Vercel deployment URL to the allowed origins.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify the route is accessible without auth**

Start the dev server (`bun dev`) and open `http://localhost:3000/docs/self-host`. It should render the guide without a login redirect.

- [ ] **Step 4: Commit**

```bash
git add app/docs/self-host/page.tsx
git commit -m "feat(docs): add /docs/self-host static guide — prerequisites, steps, env var table, troubleshooting"
```

---

## Task 7: README.md + LICENSE + final QA

**Files:**
- Create: `README.md` (repo root)
- Create: `LICENSE` (repo root)

- [ ] **Step 1: Create `README.md` at repo root**

```markdown
# noter

> AI meeting notes, on your own terms.

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_ORG/noter)

Record, transcribe, and generate structured meeting notes with AI. Self-host on Vercel + Supabase in under 10 minutes.

## What it does

- **Real-time transcription** — Deepgram-powered live transcript with speaker diarization
- **AI-generated notes** — One click turns your transcript into structured notes with action items, summaries, and key decisions
- **Fully self-hostable** — Runs on Vercel + Supabase; your meetings stay on your infrastructure

## Tech stack

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Tiptap 3
- **Backend** — Supabase (Postgres + Auth + RLS), Vercel serverless functions
- **AI** — OpenAI / Anthropic Claude via Vercel AI SDK
- **Transcription** — Deepgram real-time WebSocket

## Self-host quickstart

1. Fork this repo and clone it: `git clone https://github.com/YOUR_ORG/noter && cd noter`
2. Install dependencies: `bun install`
3. Copy env vars: `cp .env.example .env.local` and fill in your keys (see `.env.example`)
4. Run Supabase migrations: execute `scripts/001_*.sql` through `scripts/010_*.sql` in the Supabase SQL editor in order
5. Start the dev server: `bun dev` — open [http://localhost:3000](http://localhost:3000)
6. Deploy: push to GitHub, import into Vercel, add env vars, deploy

Full guide: [/docs/self-host](/docs/self-host)

## Development

​```bash
bun install       # install dependencies
bun dev           # start dev server at localhost:3000
bun run build     # production build
bun run typecheck # TypeScript check
bun run lint      # ESLint
bun test          # run tests
​```

## Contributing

Issues and PRs welcome. Open an issue first for major changes.

## License

[MIT](LICENSE) — © 2026 Gleb Starcikov
```

> **Note:** Replace all occurrences of `YOUR_ORG` with the real GitHub username/org (e.g. `glebstar06`).

- [ ] **Step 2: Create `LICENSE` at repo root**

```
MIT License

Copyright (c) 2026 Gleb Starcikov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Run final typecheck + lint**

```bash
bun run typecheck && bun run lint
```

Expected: clean pass, no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: add README.md and MIT LICENSE for OSS release"
```

---

## Acceptance Criteria Checklist

- [ ] `/` renders new OSS landing page with nav, hero, value props, how-it-works, self-host teaser, footer
- [ ] Nav shows "View on GitHub" CTA — no "Sign up for free", no theme toggle
- [ ] `components/landing-hero.tsx`, `landing-features.tsx`, `landing-workflow.tsx`, `landing-cta.tsx` deleted
- [ ] `README.md` exists at repo root with quickstart steps
- [ ] `LICENSE` exists at repo root (MIT, copyright Gleb Starcikov 2026)
- [ ] `/docs/self-host` renders without auth redirect, contains env var table and troubleshooting
- [ ] `bun run typecheck && bun run lint` pass clean
