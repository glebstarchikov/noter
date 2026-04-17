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
    <section className="mx-auto max-w-[1080px] px-12 py-16">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
        How it works
      </p>
      <h2
        className="mb-10 text-[24px] tracking-tight text-foreground"
        style={{ fontWeight: 650 }}
      >
        From recording to notes in three steps
      </h2>
      <div className="grid grid-cols-3 gap-6">
        {STEPS.map((step) => (
          <div key={step.num} className="flex flex-col gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {step.num}
            </div>
            <h3 className="text-[14px] font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="text-[13px] leading-[1.55] text-muted-foreground">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
