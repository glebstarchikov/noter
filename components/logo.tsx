import { AudioLines } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const sizeMap = {
    sm: { container: 'size-7', icon: 'size-3.5' },
    md: { container: 'size-8', icon: 'size-4' },
    lg: { container: 'size-10', icon: 'size-5' },
}

export function Logo({ size = 'md', className }: LogoProps) {
    const s = sizeMap[size]
    return (
        <div
            className={cn(
                'flex items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground',
                s.container,
                className
            )}
        >
            <AudioLines className={s.icon} />
        </div>
    )
}
