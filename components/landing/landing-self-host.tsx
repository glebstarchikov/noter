'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const FULL_COMMAND = 'git clone github.com/glebstarchikov/noter'

function useTypingEffect(text: string, inView: boolean, speed = 40) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!inView) return
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i += 1
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, inView, speed])

  return displayed
}

export function LandingSelfHost() {
  const [inView, setInView] = useState(false)
  const typed = useTypingEffect(FULL_COMMAND, inView)

  return (
    <section className="bg-card">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          onViewportEnter={() => setInView(true)}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-start gap-6 rounded-xl border border-border bg-background px-6 py-8 md:flex-row md:items-center md:justify-between md:gap-8 md:px-10 md:py-10"
        >
          {/* Left */}
          <div>
            <h2
              className="mb-2 text-[20px] tracking-tight text-foreground md:text-[22px]"
              style={{ fontWeight: 650 }}
            >
              Run it yourself
            </h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Fork the repo, add your API keys, and deploy.
              <br className="hidden sm:block" />
              Vercel + Supabase — no custom infrastructure needed.
            </p>
          </div>

          {/* Right */}
          <div className="flex w-full shrink-0 flex-col items-start gap-2.5 md:w-auto md:items-end">
            <code className="w-full overflow-x-auto whitespace-nowrap rounded-lg bg-foreground px-4 py-2.5 font-mono text-[11px] text-[#a8b4a0] sm:text-[12px] md:w-auto">
              <span className="text-accent">git clone</span>{' '}
              {typed.replace('git clone ', '')}
              <span className="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[1px] animate-pulse bg-[#a8b4a0] align-middle" />
            </code>
            <Link
              href="/docs/self-host"
              className="flex items-center gap-1 text-[12px] font-medium text-accent transition-colors hover:underline"
            >
              Read the self-host guide →
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
