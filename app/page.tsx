import Link from 'next/link'
import { LandingHero } from '@/components/landing-hero'
import { LandingFeatures } from '@/components/landing-features'

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <span className="text-lg font-semibold tracking-tight text-foreground">
          noter
        </span>
        <nav className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <LandingHero />

      {/* Features */}
      <LandingFeatures />

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-6 py-6 md:px-12">
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
