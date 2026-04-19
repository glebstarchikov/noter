'use client'

import { motion } from 'framer-motion'

const STEPS = [
  {
    num: 1,
    title: 'Record your meeting',
    body: 'Hit Record — noter captures your mic (and optionally system audio) with a live scrolling transcript alongside.',
  },
  {
    num: 2,
    title: 'Review the transcript',
    body: 'The full diarized transcript is saved automatically. Open it any time to check what was said and by whom.',
  },
  {
    num: 3,
    title: 'Generate your notes',
    body: 'Click "Create notes" when you\'re ready. AI turns the transcript into structured, editable notes — you stay in control.',
  },
]

export function LandingHowItWorks() {
  return (
    <section>
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
            How it works
          </p>
          <h2
            className="mb-10 text-[24px] tracking-tight text-foreground md:text-[28px]"
            style={{ fontWeight: 650 }}
          >
            From recording to notes in three steps
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="flex flex-col gap-2.5"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-4 ring-accent/10">
                {step.num}
              </div>
              <h3 className="text-[14px] font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-[13px] leading-[1.55] text-muted-foreground">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
