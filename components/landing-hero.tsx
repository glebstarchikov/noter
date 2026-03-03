import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-6 py-32 md:py-40">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 text-center">
        {/* Badge */}
        <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          AI-powered meeting notes
        </span>

        {/* Heading */}
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl md:leading-tight">
          Record. Transcribe.{' '}
          <span className="text-accent">Understand.</span>
        </h1>

        {/* Subheading */}
        <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Drop in your meeting audio or record live. noter turns conversations into structured notes, action items, and decisions — instantly.
        </p>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 sm:flex-row">
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
