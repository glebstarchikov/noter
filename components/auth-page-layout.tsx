import Link from 'next/link'
import { AudioLines, Sparkles } from 'lucide-react'

interface AuthPageLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

const featureHints = ['Structured summaries', 'Action item tracking', 'AI-powered chat']

export function AuthPageLayout({ title, description, children }: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-svh w-full bg-background">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-r border-border lg:flex">
        {/* Dot grid */}
        <div className="dot-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_80%)]" aria-hidden="true" />

        {/* Accent glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[400px] rounded-full bg-accent/[0.06] blur-[80px]"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-foreground text-background">
            <AudioLines className="size-7" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              noter
            </h1>
            <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
              AI-powered meeting notes. Record, transcribe, and understand.
            </p>
          </div>

          {/* Floating feature hints */}
          <div className="mt-6 flex flex-col gap-3">
            {featureHints.map((text, i) => (
              <div
                key={text}
                className="landing-fade flex items-center gap-2.5 rounded-full border border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground"
                style={{ animationDelay: `${300 + i * 150}ms` }}
              >
                <Sparkles className="size-3 text-accent" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="auth-enter w-full max-w-sm">
          <div className="flex flex-col gap-8">
            {/* Mobile logo (hidden on desktop where left panel shows it) */}
            <div className="flex flex-col items-center gap-3 lg:items-start">
              <Link href="/" className="flex items-center gap-2.5 lg:hidden">
                <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
                  <AudioLines className="size-4" />
                </div>
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  noter
                </span>
              </Link>
              <div className="flex flex-col items-center gap-1 lg:items-start">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
