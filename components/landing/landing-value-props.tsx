const PROPS = [
  {
    icon: '🎙',
    title: 'Real-time transcription',
    body: 'Deepgram-powered live transcript as you speak, with speaker diarization out of the box.',
  },
  {
    icon: '✨',
    title: 'AI-generated notes',
    body: 'One click turns your transcript into structured notes with action items, summaries, and key decisions.',
  },
  {
    icon: '🔒',
    title: 'Fully self-hostable',
    body: 'Your meetings stay on your infrastructure. Deploy to Vercel with your own Supabase project in minutes.',
  },
]

export function LandingValueProps() {
  return (
    <section className="mx-auto max-w-[1080px] px-4 py-12 sm:px-6 md:px-12 md:py-16">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
        Why noter
      </p>
      <h2
        className="mb-10 text-[24px] tracking-tight text-foreground"
        style={{ fontWeight: 650 }}
      >
        Everything you need, nothing you don&apos;t
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
        {PROPS.map((prop) => (
          <div
            key={prop.title}
            className="rounded-[14px] border border-border bg-card p-6"
          >
            <div className="mb-3.5 flex size-8 items-center justify-center rounded-lg border border-border bg-background text-sm">
              {prop.icon}
            </div>
            <h3 className="mb-1.5 text-[14px] font-semibold text-foreground">
              {prop.title}
            </h3>
            <p className="text-[13px] leading-[1.55] text-muted-foreground">
              {prop.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
