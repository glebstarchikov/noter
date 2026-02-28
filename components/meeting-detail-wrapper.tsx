'use client'

import { useState, useEffect } from 'react'
import { Sparkles, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MeetingDetail } from '@/components/meeting-detail'
import { MeetingChat } from '@/components/meeting-chat'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({
    meeting,
    meetingId,
}: {
    meeting: Meeting
    meetingId: string
}) {
    const [isChatOpen, setIsChatOpen] = useState(false)

    // Keyboard shortcut: ⌘J to toggle chat
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
                e.preventDefault()
                setIsChatOpen((prev) => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

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
                            className={cn(
                                'gap-2 border-border text-muted-foreground transition-colors',
                                isChatOpen
                                    ? 'bg-secondary text-foreground'
                                    : 'hover:border-accent/40 hover:text-foreground'
                            )}
                        >
                            {isChatOpen ? (
                                <PanelRightClose className="h-4 w-4" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
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

            {/* Chat panel — desktop: side-by-side, mobile: slide-in drawer */}
            {/* Desktop panel */}
            <div
                className={cn(
                    'hidden border-l border-border bg-background transition-all duration-300 md:flex md:flex-col',
                    isChatOpen ? 'md:w-[420px]' : 'md:w-0 md:overflow-hidden md:border-l-0'
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

            {/* Mobile: slide-in overlay */}
            {isChatOpen && (
                <>
                    <div
                        className="fixed inset-0 z-20 bg-background/60 backdrop-blur-sm md:hidden"
                        onClick={() => setIsChatOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-background sm:w-[420px] md:hidden">
                        <MeetingChat
                            meetingId={meetingId}
                            isOpen={isChatOpen}
                            onClose={() => setIsChatOpen(false)}
                            variant="inline"
                        />
                    </div>
                </>
            )}
        </div>
    )
}
