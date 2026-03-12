'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="flex flex-1 items-center px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-6">
          <Badge variant="secondary" className="landing-badge w-fit gap-1.5 rounded-full px-3 py-1">
            <Sparkles className="size-3 text-accent" />
            Calm AI meeting notes
          </Badge>

          <div className="flex flex-col gap-4">
            <h1 className="landing-stagger text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Record the meeting once. Keep the note readable after.
            </h1>
            <p className="landing-fade max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              noter turns conversations into clear notes, action items, and decisions without making the rest of your workspace feel like a dashboard.
            </p>
          </div>

          <div className="landing-fade flex flex-col items-start gap-4 sm:flex-row">
            <Button asChild size="lg" className="h-11 rounded-xl px-6 text-sm">
              <Link href="/auth/sign-up">Start for free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 rounded-xl px-6 text-sm shadow-none">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="surface-utility landing-fade flex max-w-md flex-col gap-4 rounded-[28px] px-6 py-6 text-left">
          <p className="text-sm font-medium text-foreground">What noter keeps in view</p>
          <div className="flex flex-col gap-3">
            <div className="surface-document rounded-[22px] px-4 py-4">
              <p className="text-sm font-medium text-foreground">Summary</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                A quick read of the meeting without hunting through the transcript.
              </p>
            </div>
            <div className="surface-document rounded-[22px] px-4 py-4">
              <p className="text-sm font-medium text-foreground">Action items</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Decisions and follow-ups stay attached to the note, not scattered across tabs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
