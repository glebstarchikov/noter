'use client'

import { useEffect, useRef } from 'react'
import { Sparkles, ArrowRight, PenLine, Mic } from 'lucide-react'

export function LandingWorkflow() {
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
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    )

    const items = sectionRef.current?.querySelectorAll('.reveal-up')
    items?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="relative z-10 border-y border-border/40 bg-secondary/10 px-6 py-24 md:px-10 md:py-32 overflow-hidden">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-16">
        
        {/* Section Header */}
        <div className="reveal-up text-center max-w-2xl px-4">
          <h2 className="text-3xl font-semibold tracking-tighter text-foreground md:text-5xl lg:text-5xl">
            Focus on the meeting.<br/> Let AI handle the notes.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground md:text-lg">
            Whether you need to transcribe from scratch or just polish the thoughts you jotted down, noter adapts seamlessly to your thinking process.
          </p>
        </div>

        {/* Workflow Pipeline Visualization */}
        <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-stretch lg:gap-12 w-full max-w-4xl">
          
          {/* Card 1 */}
          <div className="reveal-up liquid-glass-shell flex flex-col items-center gap-6 rounded-[2rem] p-8 text-center w-full shadow-lg" style={{ animationDelay: '100ms' }}>
            <div className="liquid-glass-orb flex size-16 items-center justify-center rounded-full shadow-inner">
              <Mic className="size-6 text-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">Record Audio</h3>
              <p className="text-sm text-muted-foreground leading-relaxed px-2">
                Hit record and stay present in the conversation.
              </p>
            </div>
          </div>

          <div className="reveal-up hidden md:flex items-center justify-center text-muted-foreground/30" style={{ animationDelay: '200ms' }}>
            <ArrowRight className="size-8" />
          </div>

          {/* Card 2 */}
          <div className="reveal-up liquid-glass-shell flex flex-col items-center gap-6 rounded-[2rem] p-8 text-center w-full md:-translate-y-4 shadow-xl border-accent/20" style={{ animationDelay: '300ms' }}>
            <div className="liquid-glass-orb flex size-16 items-center justify-center rounded-full bg-accent/10 border-accent/20">
              <Sparkles className="size-6 text-accent" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">Generate Structure</h3>
              <p className="text-sm text-muted-foreground leading-relaxed px-2">
                Our models build pristine summaries, lists, and action items from the ground up.
              </p>
            </div>
          </div>

          <div className="reveal-up hidden md:flex items-center justify-center text-muted-foreground/30" style={{ animationDelay: '400ms' }}>
            <ArrowRight className="size-8" />
          </div>

          {/* Card 3 */}
          <div className="reveal-up liquid-glass-shell flex flex-col items-center gap-6 rounded-[2rem] p-8 text-center w-full shadow-lg" style={{ animationDelay: '500ms' }}>
            <div className="liquid-glass-orb flex size-16 items-center justify-center rounded-full">
              <PenLine className="size-6 text-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">Or Refine Yourself</h3>
              <p className="text-sm text-muted-foreground leading-relaxed px-2">
                Prefer typing? Let AI improve and organize the notes you already took.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
