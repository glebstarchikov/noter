'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-16 pb-20 md:px-10 md:pt-24 md:pb-32 overflow-hidden w-full">
      
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center text-center gap-8 relative z-10">
        
        {/* Subdued Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/60 px-4 py-1.5 text-sm font-medium text-muted-foreground">
          <Sparkles className="size-4 text-accent" />
          <span>Your space for notes, tasks, and meetings.</span>
        </div>

        {/* Clean Headline */}
        <div className="flex flex-col gap-6 items-center">
          <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Focus on the meeting. <br className="hidden sm:inline" />
            <span className="text-muted-foreground">noter will do the rest.</span>
          </h1>
          
          <p className="max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
            A calm, focused workspace that turns your conversations into structured documents. No complex dashboards, just your ideas clearly organized.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="flex flex-col items-center gap-4 sm:flex-row mt-4">
          <Button asChild size="lg" className="rounded-2xl px-8 h-12 text-base font-medium shadow-sm transition-transform hover:-translate-y-0.5">
            <Link href="/auth/sign-up">
              Sign up for free
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>

      </div>

      {/* Abstract/Calm UI Representation */}
      <div className="mx-auto mt-20 w-full max-w-4xl relative">
        <div className="surface-document relative mx-auto w-full aspect-[16/10] sm:aspect-[16/9] max-w-3xl overflow-hidden rounded-[24px] bg-card p-6 sm:p-10 transition-transform duration-500 hover:scale-[1.01]">
          
          <div className="flex flex-col gap-8 h-full">
            <div className="flex items-center gap-4 border-b border-border/50 pb-4">
              <div className="h-6 w-1/3 rounded-lg bg-foreground/10" />
              <div className="ml-auto h-8 w-8 rounded-full bg-secondary" />
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="h-4 w-[90%] rounded-md bg-muted-foreground/10" />
              <div className="h-4 w-[85%] rounded-md bg-muted-foreground/10" />
              <div className="h-4 w-[95%] rounded-md bg-muted-foreground/10" />
              <div className="h-4 w-[60%] rounded-md bg-muted-foreground/10" />
            </div>
            
            <div className="mt-auto surface-empty rounded-2xl p-6 border-accent/20 border-l-4">
              <div className="h-3 w-1/4 rounded-md bg-foreground/20 mb-3" />
              <div className="h-3 w-2/3 rounded-md bg-muted-foreground/15" />
            </div>
          </div>
          
        </div>
      </div>
    </section>
  )
}
