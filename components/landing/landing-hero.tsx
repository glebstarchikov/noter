'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft sage radial gradient — full-bleed, decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(90,154,109,0.10),transparent_70%)]"
      />
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.15fr] md:gap-14 md:px-12 md:py-[88px]">
        {/* Left — text */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="mb-4 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent ring-[3px] ring-accent/20" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
              Open source · Self-hostable
            </span>
          </div>
          <h1
            className="mb-3.5 text-[32px] leading-[1.1] tracking-tight text-foreground sm:text-[40px] md:text-[44px]"
            style={{ fontWeight: 650 }}
          >
            AI meeting notes,
            <br />
            on your own terms
          </h1>
          <p className="mb-7 max-w-[440px] text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
            Record, transcribe, and generate structured notes with AI. Runs on
            Vercel + Supabase. 10-minute setup.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-all hover:opacity-90 hover:shadow-md"
            >
              Try the demo
            </Link>
            <Link
              href="/docs/self-host"
              className="rounded-full px-5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card"
            >
              Self-host →
            </Link>
          </div>
        </motion.div>

        {/* Right — product screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <Image
              src="/landing/dashboard-hero.png"
              alt="noter dashboard showing a meeting note"
              width={1600}
              height={1000}
              priority
              className="h-auto w-full"
            />
          </div>
          {/* Subtle sage glow behind screenshot */}
          <div
            aria-hidden="true"
            className="absolute -inset-4 -z-10 rounded-2xl bg-accent/10 blur-2xl"
          />
        </motion.div>
      </div>
    </section>
  )
}
