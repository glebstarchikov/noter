'use client'

import { Mic, Zap, MessageSquare } from 'lucide-react'

export function LandingFeatures() {
  return (
    <section className="relative z-10 px-6 py-24 md:px-10 md:py-32 w-full max-w-5xl mx-auto">
      <div className="flex flex-col gap-16 lg:gap-24">
        
        <div className="text-center max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Everything you need for your meetings.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            A simple, focused workflow that gets out of your way and lets you concentrate on what matters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Feature 1 */}
          <div className="surface-document rounded-3xl p-8 flex flex-col gap-6 transition-transform hover:-translate-y-1 duration-300">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/50 text-foreground border border-border/50 shadow-sm">
              <Mic className="size-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground mb-3">
                Live audio recording & upload
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Record your meetings directly in the browser or upload an existing audio file. noter securely handles the rest.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="surface-document rounded-3xl p-8 flex flex-col gap-6 transition-transform hover:-translate-y-1 duration-300">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/50 text-foreground border border-border/50 shadow-sm">
              <Zap className="size-6 text-accent" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground mb-3">
                AI transcription & structured notes
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Get highly accurate transcripts instantly, paired with beautifully structured, actionable meeting notes.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="surface-document rounded-3xl p-8 flex flex-col gap-6 transition-transform hover:-translate-y-1 duration-300">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/50 text-foreground border border-border/50 shadow-sm">
              <MessageSquare className="size-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground mb-3">
                Chat with AI about your meetings
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Ask questions to the AI about past discussions, surface decisions, or generate tailored follow-up emails in seconds.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
