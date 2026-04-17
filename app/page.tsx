import { LandingNav } from '@/components/landing/landing-nav'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingValueProps } from '@/components/landing/landing-value-props'
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works'
import { LandingSelfHost } from '@/components/landing/landing-self-host'
import { LandingFooter } from '@/components/landing/landing-footer'

export default function HomePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <div className="mx-auto max-w-[1080px] border-t border-border" />
        <LandingValueProps />
        <div className="mx-auto max-w-[1080px] border-t border-border" />
        <LandingHowItWorks />
        <div className="mx-auto max-w-[1080px] border-t border-border" />
        <LandingSelfHost />
      </main>
      <LandingFooter />
    </div>
  )
}
