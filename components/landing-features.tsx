'use client'

import { useEffect, useRef } from 'react'
import { Mic, FileText, Zap } from 'lucide-react'

const features = [
  {
    step: '01',
    icon: Mic,
    title: 'Record or upload',
    description:
      'Capture audio directly in your browser or bring in an existing recording without changing how you already work.',
  },
  {
    step: '02',
    icon: FileText,
    title: 'Transcribe quickly',
    description:
      'noter turns the conversation into text in seconds, so the note can stay grounded in what was actually said.',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Leave with structure',
    description:
      'Summaries, action items, and decisions land in one place that is easy to revisit and easy to edit.',
  },
]

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
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )

    const items = sectionRef.current?.querySelectorAll('.reveal-up')
    items?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="border-t border-border px-6 py-20 md:px-10 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <div className="reveal-up text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            One calm flow from audio to notes
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
            Every step keeps the note readable and the next action obvious.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="surface-document reveal-up flex flex-col gap-5 px-6 py-6"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {feature.step}
                </span>
                <div className="surface-utility flex size-10 items-center justify-center rounded-2xl">
                  <feature.icon className="size-4 text-foreground" />
                </div>
              </div>

              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
