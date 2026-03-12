'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LandingHero } from '@/components/landing-hero'
import { LandingFeatures } from '@/components/landing-features'
import { LandingCta } from '@/components/landing-cta'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header
        className={`sticky top-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300 md:px-10 ${scrolled ? 'glass-nav' : ''
          }`}
      >
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo className="bg-foreground text-background" />
          <span className="text-lg font-semibold tracking-tight text-foreground">
            noter
          </span>
        </Link>
        <nav className="flex items-center gap-3" aria-label="Main navigation">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
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

      <LandingHero />
      <LandingFeatures />
      <LandingCta />
      <footer className="flex items-center justify-between border-t border-border px-6 py-6 md:px-10" aria-label="Site footer">
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} noter
        </span>
        <span className="text-xs text-muted-foreground">
          Built with care.
        </span>
      </footer>
    </div>
  )
}
