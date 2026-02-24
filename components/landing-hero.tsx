import Link from 'next/link'

export function LandingHero() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 md:py-32">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
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
          Drop in your meeting audio or record live. noter turns conversations into structured notes, action items, and decisions - instantly.
        </p>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <Link
            href="/auth/sign-up"
            className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Start for free
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  )
}
