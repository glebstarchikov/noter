'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-32 md:py-40">
      {/* Subtle radial gradient behind the heading */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-accent/[0.07] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-10 text-center">
        {/* Badge with shimmer */}
        <span className="landing-badge inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          AI-powered meeting notes
        </span>

        {/* Heading with stagger animation */}
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-7xl md:leading-tight">
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
        <p className="landing-fade max-w-md text-pretty text-base leading-relaxed text-muted-foreground md:text-lg" style={{ animationDelay: '400ms' }}>
          Drop in your meeting audio or record live. noter turns conversations into structured notes, action items, and decisions — instantly.
        </p>

        {/* CTA */}
        <div className="landing-fade flex flex-col items-center gap-4 sm:flex-row" style={{ animationDelay: '500ms' }}>
          <Button asChild size="lg">
            <Link href="/auth/sign-up">
              Start for free
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
