import { cn } from '@/lib/utils'

interface StatusDotProps {
  /** The logical status. Maps to a color + label internally. */
  status: 'recording' | 'generating' | 'done' | 'error' | 'neutral'
  /** Optional label shown next to the dot. */
  label?: string
  className?: string
}

const STATUS_STYLES: Record<StatusDotProps['status'], string> = {
  recording: 'bg-[oklch(0.66_0.11_24)] ring-[oklch(0.66_0.11_24/0.18)]',
  generating: 'bg-accent ring-accent-ring',
  done: 'bg-accent ring-accent-ring',
  error: 'bg-destructive ring-[oklch(0.59_0.15_40/0.18)]',
  neutral: 'bg-muted-foreground ring-[oklch(0.49_0.006_85/0.12)]',
}

export function StatusDot({ status, label, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span
        aria-hidden
        className={cn(
          'inline-block size-2 rounded-full ring-[3px]',
          STATUS_STYLES[status],
        )}
      />
      {label && <span>{label}</span>}
    </span>
  )
}
