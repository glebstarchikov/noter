import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const pageShellVariants = cva(
  'mx-auto flex w-full flex-col px-6 py-8 md:px-10 md:py-10',
  {
    variants: {
      size: {
        default: 'max-w-6xl gap-8',
        detail: 'max-w-[72rem] gap-8',
        narrow: 'max-w-5xl gap-8',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

type PageShellProps = React.ComponentProps<'div'> &
  VariantProps<typeof pageShellVariants>

export function PageShell({
  className,
  size,
  ...props
}: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn(pageShellVariants({ size }), className)}
      {...props}
    />
  )
}

interface PageHeaderProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  eyebrow?: React.ReactNode
}

export function PageHeader({
  className,
  title,
  description,
  actions,
  eyebrow,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {eyebrow ? <div>{eyebrow}</div> : null}
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <div className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start md:self-auto">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
