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
        <section ref={sectionRef} className="relative overflow-hidden border-t border-border px-6 py-24 md:px-12 md:py-32">
            {/* Ambient accent glow */}
            <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] rounded-full bg-accent/20 blur-[80px]"
                aria-hidden="true"
            />

            <div className="reveal-up relative z-10 mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
                    Ready to get started?
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                    Turn your next meeting into structured, searchable notes in minutes.
                </p>
                <Button asChild size="lg" className="h-12 px-8 text-sm">
                    <Link href="/auth/sign-up">
                        Start for free
                    </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                    No credit card required
                </p>
            </div>
        </section>
    )
}
