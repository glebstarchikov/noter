'use client'

import { motion } from 'framer-motion'
import { Mic, Sparkles, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Prop {
  icon: LucideIcon
  title: string
  body: string
}

const PROPS: Prop[] = [
  {
    icon: Mic,
    title: 'Real-time transcription',
    body: 'Deepgram-powered live transcript as you speak, with speaker diarization out of the box.',
  },
  {
    icon: Sparkles,
    title: 'AI-generated notes',
    body: 'One click turns your transcript into structured notes with action items, summaries, and key decisions.',
  },
  {
    icon: Lock,
    title: 'Fully self-hostable',
    body: 'Your meetings stay on your infrastructure. Deploy to Vercel with your own Supabase project in minutes.',
  },
]

export function LandingValueProps() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
            Why noter
          </p>
          <h2
            className="mb-10 text-[24px] tracking-tight text-foreground md:text-[28px]"
            style={{ fontWeight: 650 }}
          >
            Everything you need, nothing you don&apos;t
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {PROPS.map((prop, i) => {
            const Icon = prop.icon
            return (
              <motion.div
                key={prop.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="rounded-[14px] border border-border bg-background p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-3.5 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                  <Icon className="size-[18px]" strokeWidth={1.75} />
                </div>
                <h3 className="mb-1.5 text-[14px] font-semibold text-foreground">
                  {prop.title}
                </h3>
                <p className="text-[13px] leading-[1.55] text-muted-foreground">
                  {prop.body}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
