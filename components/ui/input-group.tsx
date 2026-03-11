'use client'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        'group/input-group border-input relative flex h-8 w-full min-w-0 items-center rounded-xl border transition-colors outline-none',
        'dark:bg-input/30 shadow-xs',
        'has-disabled:bg-input/50 has-disabled:opacity-50 dark:has-disabled:bg-input/80',
        'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col',
        'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col',
        'has-[>textarea]:h-auto',
        'has-[>[data-align=inline-end]]:[&>[data-slot=input-group-control]]:pr-1.5',
        'has-[>[data-align=inline-start]]:[&>[data-slot=input-group-control]]:pl-1.5',
        'has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:pt-2',
        'has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:pb-2',
        'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]',
        'has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:ring-[3px]',
        'dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text items-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        'inline-start':
          'order-first justify-start pl-2.5 has-[>button]:ml-[-0.2rem] has-[>kbd]:ml-[-0.1rem]',
        'inline-end':
          'order-last justify-end pr-2.5 has-[>button]:mr-[-0.2rem] has-[>kbd]:mr-[-0.1rem]',
        'block-start':
          'order-first w-full justify-start px-2.5 pt-3 [.border-b]:pb-2 group-has-[>input]/input-group:pt-2',
        'block-end':
          'order-last w-full justify-start px-2.5 pb-2 [.border-t]:pt-2 group-has-[>input]/input-group:pb-2',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        e.currentTarget.parentElement
          ?.querySelector<HTMLElement>('[data-slot=input-group-control]')
          ?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  'flex items-center gap-2 text-sm shadow-none',
  {
    variants: {
      size: {
        xs: 'h-6 rounded-md px-2 text-xs',
        sm: 'h-8 rounded-lg px-2.5',
        'icon-xs': 'size-6 rounded-md p-0',
        'icon-sm': 'size-8 rounded-full p-0',
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  },
)

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent px-2.5 py-2 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent',
        className,
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        'min-h-16 flex-1 resize-none rounded-none border-0 bg-transparent px-2.5 py-2 text-base shadow-none focus-visible:ring-0 dark:bg-transparent md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
