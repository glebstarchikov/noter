'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LandingHero } from '@/components/landing-hero'
import { LandingFeatures } from '@/components/landing-features'
import { LandingWorkflow } from '@/components/landing-workflow'
import { LandingCta } from '@/components/landing-cta'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="relative flex min-h-svh flex-col bg-background overflow-hidden selection:bg-accent/20">
      
      {/* Background Mesh/Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] left-1/2 w-[120vw] -translate-x-1/2 h-[70vh] bg-accent/10 blur-[120px] rounded-[100%] dark:bg-accent/5" />
        <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] bg-secondary/80 blur-[100px] rounded-full mix-blend-multiply dark:bg-secondary/20 dark:mix-blend-lighten" />
        <div className="absolute top-[10%] right-[-10%] w-[40vw] h-[40vw] bg-muted/80 blur-[100px] rounded-full mix-blend-multiply dark:bg-muted/10 dark:mix-blend-lighten" />
      </div>

      {/* Floating Header */}
      <header className="fixed top-0 inset-x-0 z-50 flex justify-center w-full p-4 pointer-events-none data-[scrolled=true]:p-2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" data-scrolled={scrolled}>
        <div className="pointer-events-auto flex w-full max-w-6xl items-center justify-between rounded-full border border-transparent bg-transparent px-6 py-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] data-[scrolled=true]:border-border/40 data-[scrolled=true]:bg-background/60 data-[scrolled=true]:py-3 data-[scrolled=true]:shadow-lg data-[scrolled=true]:backdrop-blur-xl" data-scrolled={scrolled}>
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo size="sm" className="bg-foreground text-background" />
            <span className="text-base font-semibold tracking-tight text-foreground">
              noter
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-3" aria-label="Main navigation">
            <ThemeToggle />
            <Link
              href="/auth/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:inline-block"
            >
              Sign in
            </Link>
            <Button asChild size="sm" className="rounded-full px-5 shadow-none transition-transform hover:scale-105 active:scale-95">
              <Link href="/auth/sign-up">
                Get started
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex flex-col pt-32 sm:pt-40">
        <LandingHero />
        <LandingWorkflow />
        <LandingFeatures />
        <LandingCta />
      </main>

      <footer className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-border/40 bg-background/40 px-6 py-8 backdrop-blur-md md:flex-row md:px-10" aria-label="Site footer">
        <div className="flex items-center gap-2">
          <Logo size="sm" className="bg-foreground text-background grayscale" />
          <span className="text-xs font-semibold text-foreground">noter</span>
        </div>
        <div className="flex text-xs text-muted-foreground gap-6">
          <span>© {new Date().getFullYear()}</span>
          <span>Crafted for clarity.</span>
        </div>
      </footer>
    </div>
  )
}
