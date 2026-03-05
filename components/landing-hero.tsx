'use client'

import Link from 'next/link'
import { Sparkles, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 md:py-36">
      {/* Dot grid background */}
      <div
        className="dot-grid pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      {/* Radial fade at edges */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--background)_80%)]" />
      </div>

      {/* Accent glow behind heading */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-accent/[0.06] blur-[100px]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-10 text-center">
        {/* Badge with shimmer */}
        <span className="landing-badge inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3 text-accent" />
          AI-powered meeting notes
        </span>

        {/* Heading with stagger animation */}
        <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tighter text-foreground sm:text-5xl md:text-7xl lg:text-8xl">
          <span className="landing-stagger inline-block" style={{ animationDelay: '0ms' }}>
            Record.
          </span>{' '}
          <span className="landing-stagger inline-block" style={{ animationDelay: '120ms' }}>
            Transcribe.
          </span>
          <br />
          <span className="landing-stagger inline-block text-accent" style={{ animationDelay: '240ms' }}>
            Understand.
          </span>
        </h1>

        {/* Subheading */}
        <p className="landing-fade max-w-lg text-pretty text-base leading-relaxed text-muted-foreground md:text-lg" style={{ animationDelay: '400ms' }}>
          Drop in your meeting audio or record live. noter turns conversations into structured notes, action items, and decisions — instantly.
        </p>

        {/* CTA */}
        <div className="landing-fade flex flex-col items-center gap-4 sm:flex-row" style={{ animationDelay: '500ms' }}>
          <Button asChild size="lg" className="h-12 px-8 text-sm">
            <Link href="/auth/sign-up">
              Start for free
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-8 text-sm">
            <Link href="/auth/login">
              Sign in
            </Link>
          </Button>
        </div>

        {/* Floating glass chatbar preview */}
        <div
          className="landing-fade animate-float w-full max-w-md"
          style={{ animationDelay: '700ms' }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-3 rounded-full border border-black/[0.08] bg-black/[0.03] px-5 py-3 shadow-[0_4px_24px_-4px_oklch(0_0_0/0.08)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-white/[0.06] dark:shadow-[0_4px_24px_-4px_oklch(0_0_0/0.4)]">
            <Sparkles className="size-4 shrink-0 text-accent" />
            <span className="flex-1 text-sm text-muted-foreground">
              Ask across all meetings...
            </span>
            <kbd className="hidden rounded-md border border-black/[0.06] bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.06] md:inline-block">
              ⌘J
            </kbd>
            <Send className="size-4 text-accent" />
          </div>
        </div>
      </div>
    </section>
  )
}
