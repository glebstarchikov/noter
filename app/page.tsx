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
        <LandingValueProps />
        <LandingHowItWorks />
        <LandingSelfHost />
      </main>
      <LandingFooter />
    </div>
  )
}
