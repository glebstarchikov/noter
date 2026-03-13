'use client'

import { useEffect, useRef } from 'react'
import { FileText, Zap, Layers, Share } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LandingFeatures() {
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
      { threshold: 0.1, rootMargin: '0px 0px -5% 0px' }
    )

    const items = sectionRef.current?.querySelectorAll('.reveal-up')
    items?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="relative z-10 px-6 py-24 md:px-10 md:py-32 overflow-hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:gap-16">
        
        <div className="reveal-up text-center max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-semibold tracking-tighter text-foreground md:text-5xl lg:text-5xl">
            Structure that adapts to your thinking.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground md:text-lg">
            noter doesn't force a rigid format. It intelligently categorizes your thoughts, action items, and decisions to give you clarity exactly when you need it.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 leading-relaxed">
          
          {/* Bento Large Feature 1 */}
          <div className="reveal-up liquid-glass-shell group relative overflow-hidden rounded-[2rem] md:col-span-8 flex flex-col justify-end p-8 md:p-10 min-h-[400px]" style={{ animationDelay: '100ms' }}>
            <div className="absolute top-10 right-10 flex gap-4 opacity-50 transition-opacity duration-500 group-hover:opacity-100">
               <div className="surface-document rounded-xl p-4 shadow-xl translate-x-4 translate-y-4 -rotate-6 transition-transform duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-0">
                  <div className="h-2 w-24 rounded bg-accent/40 mb-3" />
                  <div className="h-2 w-32 rounded bg-muted-foreground/20" />
               </div>
               <div className="surface-document rounded-xl p-4 shadow-xl -translate-x-4 -translate-y-4 rotate-3 z-10 transition-transform duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-0">
                  <div className="h-2 w-20 rounded bg-primary/40 mb-3" />
                  <div className="h-2 w-28 rounded bg-muted-foreground/20" />
               </div>
            </div>
            
            <div className="relative z-10 max-w-sm">
              <div className="liquid-glass-orb flex size-12 items-center justify-center rounded-xl mb-6">
                <FileText className="size-5 text-foreground" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Pristine Transcripts</h3>
              <p className="text-sm text-muted-foreground">
                High accuracy voice-to-text ensures the raw material of your meetings is never lost. 
              </p>
            </div>
          </div>

          {/* Bento Small Feature 1 */}
          <div className="reveal-up liquid-glass-shell group relative overflow-hidden rounded-[2rem] md:col-span-4 flex flex-col justify-end p-8 md:p-10 min-h-[400px]" style={{ animationDelay: '200ms' }}>
            <div className="absolute -top-12 -right-12 size-48 bg-accent/10 blur-[50px] rounded-full transition-transform duration-700 group-hover:scale-150" />
            
            <div className="relative z-10">
              <div className="liquid-glass-orb flex size-12 items-center justify-center rounded-xl mb-6">
                <Zap className="size-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground mb-3">AI Context Engine</h3>
              <p className="text-sm text-muted-foreground">
                Instantly extract key decisions, dates, and names. noter connects the dots so you don't have to.
              </p>
            </div>
          </div>

          {/* Bento Small Feature 2 */}
          <div className="reveal-up liquid-glass-shell group relative overflow-hidden rounded-[2rem] md:col-span-5 flex flex-col justify-end p-8 md:p-10 min-h-[400px]" style={{ animationDelay: '300ms' }}>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none" />
            
            <div className="relative z-10">
              <div className="liquid-glass-orb flex size-12 items-center justify-center rounded-xl mb-6">
                <Layers className="size-5 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground mb-3">Search across time</h3>
              <p className="text-sm text-muted-foreground">
                Ask the global chat questions to surface insights across every note and file you've ever stored.
              </p>
            </div>
          </div>

          {/* Bento Large Feature 2 */}
          <div className="reveal-up liquid-glass-shell group relative overflow-hidden rounded-[2rem] md:col-span-7 flex flex-col justify-end p-8 md:p-10 min-h-[400px]" style={{ animationDelay: '400ms' }}>
            <div className="absolute -right-20 -bottom-20 opacity-40 transition-transform duration-700 group-hover:scale-105 group-hover:-translate-x-4">
              <div className="surface-document w-72 h-48 rounded-[24px] border-l-4 border-l-accent p-6 shadow-2xl skew-y-3">
                 <div className="h-3 w-32 rounded bg-foreground/20 mb-6" />
                 <div className="flex gap-4 mb-4">
                   <div className="size-8 rounded-full bg-muted-foreground/20 shrink-0" />
                   <div className="flex flex-col gap-2 w-full pt-1">
                      <div className="h-2 w-full rounded bg-muted-foreground/10" />
                      <div className="h-2 w-3/4 rounded bg-muted-foreground/10" />
                   </div>
                 </div>
              </div>
            </div>

            <div className="relative z-10 max-w-sm">
              <div className="liquid-glass-orb flex size-12 items-center justify-center rounded-xl mb-6">
                <Share className="size-5 text-foreground" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Stay in the loop</h3>
              <p className="text-sm text-muted-foreground">
                Easily pull up actions or send polished summaries to your team before the call even ends.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
