'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { LandingHero } from '@/components/landing-hero'
import { LandingFeatures } from '@/components/landing-features'
import { LandingWorkflow } from '@/components/landing-workflow'
import { LandingCta } from '@/components/landing-cta'

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="relative flex min-h-svh flex-col bg-background selection:bg-accent/20">
      
      {/* Floating Header */}
      <header 
        className="fixed top-0 inset-x-0 z-50 flex justify-center w-full p-4 pointer-events-none transition-all duration-300 ease-in-out data-[scrolled=true]:p-2" 
        data-scrolled={scrolled}
      >
        <div 
          className="pointer-events-auto flex w-full max-w-5xl items-center justify-between rounded-2xl border border-transparent bg-transparent px-6 py-4 transition-all duration-300 ease-in-out data-[scrolled=true]:border-border/40 data-[scrolled=true]:bg-background/80 data-[scrolled=true]:py-3 data-[scrolled=true]:shadow-sm data-[scrolled=true]:backdrop-blur-md" 
          data-scrolled={scrolled}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo size="sm" className="bg-foreground text-background" />
            <span className="text-base font-semibold tracking-tight text-foreground">
              noter
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Main navigation">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:inline-block"
            >
              Sign in
            </Link>
            <Button asChild size="sm" className="rounded-xl px-5 shadow-none transition-transform hover:scale-105 active:scale-95">
              <Link href="/auth/sign-up">
                Sign up for free
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex flex-col pt-32 sm:pt-40 items-center w-full">
        <LandingHero />
        <LandingFeatures />
      </main>

      <footer className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-border/40 bg-background/40 px-6 py-8 md:flex-row md:px-10 mt-auto w-full max-w-5xl mx-auto" aria-label="Site footer">
        <div className="flex items-center gap-2">
          <Logo size="sm" className="bg-foreground text-background grayscale" />
          <span className="text-xs font-semibold text-foreground">noter</span>
        </div>
        <div className="flex text-xs text-muted-foreground gap-6">
          <span>© {new Date().getFullYear()}</span>
          <span>Focus on the meeting.</span>
        </div>
      </footer>
    </div>
  )
}
