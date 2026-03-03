'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
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
            <DropdownMenuTrigger asChild>
                <button
                    className={cn(
                        'inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                        className
                    )}
                    aria-label="Toggle theme"
                >
                    <ActiveIcon className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {themes.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem
                        key={value}
                        onClick={() => setTheme(value)}
                        className={cn(theme === value && 'bg-accent')}
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
                    className={cn(theme === value && 'bg-accent')}
                >
                    <Icon className="size-4" />
                    {label}
                </DropdownMenuItem>
            ))}
        </>
    )
}
