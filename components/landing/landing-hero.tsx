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
