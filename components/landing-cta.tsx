'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingCta() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
          }
        })
      },
      { threshold: 0.2 }
    )

    const items = sectionRef.current?.querySelectorAll('.reveal-up')
    items?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="border-t border-border px-6 py-20 md:px-10 md:py-24">
      <div className="reveal-up surface-utility mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-[32px] px-8 py-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Ready to make your notes easier to revisit?
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Turn your next meeting into structured, searchable notes in minutes.
        </p>
        <Button asChild size="lg" className="h-11 rounded-xl px-6 text-sm">
          <Link href="/auth/sign-up">Start for free</Link>
        </Button>
        <p className="text-xs text-muted-foreground">No credit card required</p>
      </div>
    </section>
  )
}
