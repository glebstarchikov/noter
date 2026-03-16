import { cva, type VariantProps } from 'class-variance-authority'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

const statusPanelVariants = cva('surface-status rounded-[24px] px-5 py-4', {
  variants: {
    tone: {
      default: 'border-border/70 bg-secondary/55',
      success: 'border-border/70 bg-secondary/55',
      destructive: 'border-destructive/20 bg-destructive/5',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
})

interface StatusPanelProps
  extends Omit<React.ComponentProps<typeof Alert>, 'title'>,
    VariantProps<typeof statusPanelVariants> {
  title: React.ReactNode
  description: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
}

export function StatusPanel({
  className,
  title,
  description,
  icon,
  actions,
  tone,
  ...props
}: StatusPanelProps) {
  return (
    <Alert className={cn(statusPanelVariants({ tone }), className)} {...props}>
      {icon}
      <div className="col-start-2 flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <AlertTitle className="line-clamp-none">{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </Alert>
  )
}
