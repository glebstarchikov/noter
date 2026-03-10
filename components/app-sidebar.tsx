'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    FileText,
    LayoutTemplate,
    LogOut,
    Plus,
    ChevronsUpDown,
    PanelLeftIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { ThemeToggleInline } from '@/components/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar'

const navItems = [
    { href: '/dashboard', label: 'Notes', icon: FileText },
    { href: '/dashboard/templates', label: 'Formats', icon: LayoutTemplate },
]


function SidebarBrandToggle() {
    const { state, isMobile, toggleSidebar } = useSidebar()
    const showExpandedLayout = isMobile || state === 'expanded'

    if (showExpandedLayout) {
        return (
            <div className="flex items-center justify-between gap-2">
                <Link
                    href="/dashboard"
                    className="ring-sidebar-ring flex items-center gap-3 rounded-md outline-hidden focus-visible:ring-2"
                    aria-label="Go to dashboard"
                >
                    <Logo />
                    <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
                        noter
                    </span>
                </Link>
                <Button
                    variant="ghost-icon"
                    size="icon-sm"
                    onClick={toggleSidebar}
                    aria-label="Collapse sidebar"
                    className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                    <PanelLeftIcon className="size-4" />
                </Button>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="group/brand text-sidebar-foreground ring-sidebar-ring relative flex size-8 items-center justify-center rounded-md outline-hidden focus-visible:ring-2"
        >
            <span className="pointer-events-none transition-all duration-150 ease-out motion-reduce:transition-none group-hover/brand:translate-y-0.5 group-hover/brand:opacity-0 group-focus-visible/brand:translate-y-0.5 group-focus-visible/brand:opacity-0">
                <Logo />
            </span>
            <PanelLeftIcon className="pointer-events-none absolute size-4 translate-y-0.5 opacity-0 transition-all duration-150 ease-out motion-reduce:transition-none group-hover/brand:translate-y-0 group-hover/brand:opacity-100 group-focus-visible/brand:translate-y-0 group-focus-visible/brand:opacity-100" />
        </button>
    )
}

export function AppSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [userEmail, setUserEmail] = useState<string | null>(null)

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data }) => {
            setUserEmail(data?.user?.email ?? null)
        })
    }, [])

    const handleSignOut = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/')
    }

    const initials = userEmail
        ? userEmail.substring(0, 2).toUpperCase()
        : '?'
    const displayName = userEmail?.split('@')[0]?.replace(/[._-]+/g, ' ') ?? 'Your workspace'

    return (
        <Sidebar collapsible="icon" variant="floating">
            {/* Header */}
            <SidebarHeader>
                <SidebarBrandToggle />
            </SidebarHeader>

            {/* Content */}
            <SidebarContent>
                {/* New meeting action */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    tooltip="New meeting"
                                    className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                                >
                                    <Link href="/dashboard/new">
                                        <Plus />
                                        <span>New meeting</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Navigation */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                const isActive = item.href === '/dashboard'
                                    ? pathname === '/dashboard'
                                    : pathname.startsWith(item.href)
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                                            <Link href={item.href}>
                                                <item.icon />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* Footer — User profile dropdown */}
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <Avatar className="h-8 w-8 rounded-full">
                                        <AvatarFallback className="rounded-full text-[10px] font-medium">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-medium">
                                            {displayName}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {userEmail ?? 'Signed in'}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                side="top"
                                align="end"
                                sideOffset={4}
                            >
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                        <Avatar className="h-8 w-8 rounded-full">
                                            <AvatarFallback className="rounded-full text-[10px] font-medium">
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-medium">
                                                {displayName}
                                            </span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {userEmail ?? 'Signed in'}
                                            </span>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <ThemeToggleInline />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleSignOut}>
                                    <LogOut />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            {/* Rail for drag-to-toggle */}
            <SidebarRail />
        </Sidebar>
    )
}
