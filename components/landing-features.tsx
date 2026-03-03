import { Mic, FileText, Zap } from 'lucide-react'

const features = [
  {
    icon: Mic,
    title: 'Record or upload',
    description:
      'Capture audio directly in your browser or drop in an existing recording. Supports mp3, wav, m4a, and webm.',
  },
  {
    icon: FileText,
    title: 'Instant transcription',
    description:
      'OpenAI Whisper turns your audio into accurate text in seconds. No manual note-taking required.',
  },
  {
    icon: Zap,
    title: 'Structured notes',
    description:
      'AI extracts a summary, action items, key decisions, topics discussed, and follow-ups from every meeting.',
  },
]

export function LandingFeatures() {
  return (
    <section className="border-t border-border px-6 py-20 md:px-12">
      <div className="mx-auto grid max-w-4xl gap-12 md:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="flex flex-col gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card">
              <feature.icon className="size-5 text-accent" />
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
    </section>
  )
}
