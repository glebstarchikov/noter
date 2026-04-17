'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    const ActiveIcon = mounted
        ? (themes.find((t) => t.value === theme)?.icon ?? Monitor)
        : Monitor

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn('text-muted-foreground shadow-none', className)}
                            aria-label="Theme"
                        >
                            <ActiveIcon className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Theme</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
                {themes.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(theme === value && 'bg-secondary text-secondary-foreground')}
                    >
                        <Icon className="size-4" />
                        {label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/** Inline variant for use inside dropdown menus (e.g. sidebar profile dropdown) */
export function ThemeToggleInline() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    if (!mounted) return null

    return (
        <>
            {themes.map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(theme === value && 'bg-secondary text-secondary-foreground')}
                >
                    <Icon className="size-4" />
                    {label}
                </DropdownMenuItem>
            ))}
        </>
    )
}
