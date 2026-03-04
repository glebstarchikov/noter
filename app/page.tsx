import Link from 'next/link'
import { AudioLines } from 'lucide-react'
import { LandingHero } from '@/components/landing-hero'
import { LandingFeatures } from '@/components/landing-features'
import { LandingCta } from '@/components/landing-cta'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
            <AudioLines className="size-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            noter
          </span>
        </Link>
        <nav className="flex items-center gap-3" aria-label="Main navigation">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/auth/sign-up">
              Get started
            </Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <LandingHero />

      {/* Features */}
      <LandingFeatures />

      {/* CTA */}
      <LandingCta />

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-6 py-6 md:px-12" aria-label="Site footer">
        <span className="text-xs text-muted-foreground">
          noter
        </span>
        <span className="text-xs text-muted-foreground">
          Built with care.
        </span>
      </footer>
    </div>
  )
}
