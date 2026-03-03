'use client'

import { useState, useEffect } from 'react'
import { Sparkles, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'

import { cn } from '@/lib/utils'
import { MeetingDetail } from '@/components/meeting-detail'
import { MeetingChat } from '@/components/meeting-chat'
import { useIsMobile } from '@/hooks/use-mobile'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({
    meeting,
    meetingId,
}: {
    meeting: Meeting
    meetingId: string
}) {
    const [isChatOpen, setIsChatOpen] = useState(false)
    const isMobile = useIsMobile()

    // Keyboard shortcuts: ⌘J to toggle chat, Escape to close mobile overlay
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
                e.preventDefault()
                setIsChatOpen((prev) => !prev)
            }
            if (e.key === 'Escape' && isChatOpen) {
                setIsChatOpen(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isChatOpen])

    return (
        <div className="flex h-full">
            {/* Main content */}
            <div
                className={cn(
                    'flex-1 overflow-y-auto transition-all duration-300',
                    isChatOpen ? 'md:pr-0' : ''
                )}
            >
                <div className="flex flex-col gap-6 p-6 md:p-10">
                    {/* Chat toggle button in header area */}
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            aria-expanded={isChatOpen}
                            aria-controls={isMobile ? undefined : 'meeting-chat-panel'}
                            className={cn(
                                'gap-2 border-border text-muted-foreground transition-colors',
                                isChatOpen
                                    ? 'bg-secondary text-foreground'
                                    : 'hover:bg-secondary hover:text-foreground'
                            )}
                        >
                            {isChatOpen ? (
                                <PanelRightClose className="size-4" />
                            ) : (
                                <Sparkles className="size-4" />
                            )}
                            <span className="hidden sm:inline">
                                {isChatOpen ? 'Close AI' : 'Ask AI'}
                            </span>
                            <kbd className="ml-1 hidden rounded border border-border bg-background px-1 py-0.5 text-[10px] text-muted-foreground md:inline-block">
                                ⌘J
                            </kbd>
                        </Button>
                    </div>

                    <MeetingDetail meeting={meeting} />
                </div>
            </div>

            {/* Desktop panel — always rendered, uses translate-x for GPU-accelerated slide */}
            <div
                id="meeting-chat-panel"
                className={cn(
                    'hidden border-l border-border bg-background transition-transform duration-300 ease-out md:flex md:flex-col md:sticky md:top-0 md:h-screen',
                    isChatOpen ? 'md:w-[360px] lg:w-[420px] md:translate-x-0' : 'md:w-0 md:translate-x-full md:overflow-hidden md:border-l-0'
                )}
            >
                {isChatOpen && (
                    <MeetingChat
                        meetingId={meetingId}
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                        variant="inline"
                    />
                )}
            </div>

            {/* Mobile: use Radix sheet for focus trap + escape handling */}
            {isMobile && (
                <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
                    <SheetContent
                        side="right"
                        className="w-full gap-0 border-l border-border p-0 sm:max-w-[420px] [&>button]:hidden"
                    >
                        <SheetHeader className="sr-only">
                            <SheetTitle>Meeting AI chat</SheetTitle>
                            <SheetDescription>
                                Ask questions about this meeting transcript and notes.
                            </SheetDescription>
                        </SheetHeader>
                        <MeetingChat
                            meetingId={meetingId}
                            isOpen={isChatOpen}
                            onClose={() => setIsChatOpen(false)}
                            variant="inline"
                        />
                    </SheetContent>
                </Sheet>
            )}
        </div>
    )
}
