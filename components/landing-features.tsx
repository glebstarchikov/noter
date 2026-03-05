'use client'

import { useEffect, useRef } from 'react'
import { Mic, FileText, Zap } from 'lucide-react'

const features = [
  {
    step: '01',
    icon: Mic,
    title: 'Record or upload',
    description:
      'Capture audio directly in your browser or drop in an existing recording. Supports mp3, wav, m4a, and webm.',
  },
  {
    step: '02',
    icon: FileText,
    title: 'Instant transcription',
    description:
      'OpenAI Whisper turns your audio into accurate text in seconds. No manual note-taking required.',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Structured notes',
    description:
      'AI extracts a summary, action items, key decisions, topics discussed, and follow-ups from every meeting.',
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
    <section ref={sectionRef} className="border-t border-border px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-4xl">
        {/* Section heading */}
        <div className="reveal-up mb-16 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            How it works
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Three steps from audio to actionable notes.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="reveal-up group flex flex-col gap-4 rounded-xl border-l-2 border-accent/30 bg-secondary/40 p-6 transition-all duration-300 hover:border-accent hover:bg-secondary/60"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {/* Step number + Icon */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium tracking-widest text-accent">
                  {feature.step}
                </span>
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10 transition-colors group-hover:bg-accent/15">
                  <feature.icon className="size-5 text-accent" />
                </div>
              </div>

              <h3 className="text-sm font-medium text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
