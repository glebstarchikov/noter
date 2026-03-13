'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-10 pb-20 md:px-10 md:pt-16 md:pb-32 overflow-hidden">
      
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center gap-8 relative z-10">
        
        {/* Eyebrow */}
        <Badge variant="secondary" className="landing-stagger liquid-glass-chip gap-2 rounded-full px-4 py-1.5 text-sm shadow-sm">
          <Sparkles className="size-3.5 text-accent animate-pulse" />
          <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent italic">
            Your space for notes, tasks, and big ideas.
          </span>
        </Badge>

        {/* Massive Headline */}
        <div className="flex flex-col gap-6 items-center">
          <h1 className="landing-fade max-w-4xl text-balance text-5xl font-semibold tracking-tighter text-foreground sm:text-6xl md:text-7xl lg:text-8xl">
            Think clearly. <br className="hidden sm:inline" />
            <span className="text-muted-foreground">Capture instantly.</span>
          </h1>
          
          <p className="landing-fade max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl" style={{ animationDelay: '100ms' }}>
            noter is a calm, focused workspace that turns your meetings into structured documents, without the noise of a developer dashboard.
          </p>
        </div>

        {/* CTA */}
        <div className="landing-fade flex flex-col items-center gap-4 sm:flex-row mt-4" style={{ animationDelay: '200ms' }}>
          <Button asChild size="lg" className="liquid-glass-fab rounded-full px-8 h-12 text-base font-semibold group relative overflow-hidden">
            <Link href="/auth/sign-up">
              <span className="relative z-10">Start for free</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] dark:via-white/5" />
            </Link>
          </Button>
        </div>

      </div>

      {/* Floating UI Mockup */}
      <div className="landing-fade mx-auto mt-20 w-full max-w-5xl relative perspective-1000" style={{ animationDelay: '400ms' }}>
        <div className="liquid-glass-shell relative mx-auto w-full aspect-[16/10] sm:aspect-[16/9] max-w-4xl overflow-hidden rounded-[2rem] border border-border/50 shadow-2xl transition-transform duration-700 hover:scale-[1.02] hover:-translate-y-2 group">
          
          {/* Faux header */}
          <div className="absolute top-0 inset-x-0 h-14 border-b border-border/40 bg-background/40 backdrop-blur-md flex items-center px-6 gap-2">
            <div className="flex gap-1.5">
              <div className="size-3 rounded-full bg-muted-foreground/30" />
              <div className="size-3 rounded-full bg-muted-foreground/30" />
              <div className="size-3 rounded-full bg-muted-foreground/30" />
            </div>
          </div>
          
          {/* Faux content */}
          <div className="absolute top-14 inset-0 bg-background/50 p-8 flex gap-8">
            {/* Sidebar mock */}
            <div className="hidden sm:flex flex-col gap-4 w-48 border-r border-border/40 pr-6">
              <div className="h-4 w-24 rounded bg-muted-foreground/20" />
              <div className="h-4 w-32 rounded bg-muted-foreground/10" />
              <div className="h-4 w-28 rounded bg-muted-foreground/10" />
            </div>
            
            {/* Editor mock */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="h-8 w-3/4 rounded-lg bg-foreground/10" />
              <div className="space-y-3">
                <div className="h-4 w-full rounded bg-muted-foreground/10" />
                <div className="h-4 w-[90%] rounded bg-muted-foreground/10" />
                <div className="h-4 w-[95%] rounded bg-muted-foreground/10" />
              </div>
              
              {/* Action items mock floating */}
              <div className="mt-4 surface-document rounded-[20px] p-5 max-w-sm border-l-2 border-l-accent shadow-lg group-hover:-translate-y-1 transition-transform duration-500">
                <div className="h-4 w-32 rounded bg-foreground/20 mb-4" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-4 rounded border border-muted-foreground/30" />
                  <div className="h-3 w-48 rounded bg-muted-foreground/20" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-4 rounded border border-muted-foreground/30" />
                  <div className="h-3 w-40 rounded bg-muted-foreground/20" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Subtle reflection overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none mix-blend-overlay dark:via-white/2 dark:to-white/5" />
        </div>
      </div>
    </section>
  )
}
