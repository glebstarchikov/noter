import Link from 'next/link'

export function LandingSelfHost() {
  return (
    <section className="mx-auto max-w-[1080px] px-4 py-12 sm:px-6 md:px-12 md:py-16">
      <div className="flex flex-col items-start gap-6 rounded-xl border border-border bg-card px-6 py-7 md:flex-row md:items-center md:justify-between md:gap-8 md:px-10 md:py-9">
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
        <div className="flex w-full shrink-0 flex-col items-start gap-2.5 md:w-auto md:items-end">
          <code className="w-full overflow-x-auto whitespace-nowrap rounded-lg bg-foreground px-4 py-2.5 font-mono text-[11px] text-[#a8b4a0] sm:text-[12px] md:w-auto">
            <span className="text-accent">git clone</span>{' '}
            github.com/glebstar06/noter
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
