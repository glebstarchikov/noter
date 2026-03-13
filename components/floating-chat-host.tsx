'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChatBar } from '@/components/chat-bar'
import { TranscriptBubble } from '@/components/transcript-bubble'
import { createClient } from '@/lib/supabase/client'
import type { ChatSurfaceScope } from '@/lib/types'

const RESERVED_DASHBOARD_SEGMENTS = new Set(['new', 'templates'])

type FloatingChatConfig =
  | { visible: false }
  | {
      visible: true
      authenticated: boolean
      allowGlobalToggle: boolean
      defaultScope: ChatSurfaceScope
      meetingId: string | null
    }

function resolveMeetingId(pathname: string) {
  const match = pathname.match(/^\/dashboard\/([^/]+)$/)
  if (!match) return null

  return RESERVED_DASHBOARD_SEGMENTS.has(match[1]) ? null : match[1]
}

export function FloatingChatHost() {
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let isActive = true

    void supabase.auth.getUser().then(({ data }) => {
      if (isActive) {
        setIsAuthenticated(Boolean(data.user))
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive) {
        setIsAuthenticated(Boolean(session?.user))
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  const config = useMemo<FloatingChatConfig>(() => {
    if (pathname.startsWith('/auth/')) {
      return { visible: false }
    }

    if (pathname === '/') {
      return {
        visible: true,
        authenticated: false,
        allowGlobalToggle: false,
        defaultScope: 'support' as ChatSurfaceScope,
        meetingId: null,
      }
    }

    if (!pathname.startsWith('/dashboard')) {
      return { visible: false }
    }

    if (isAuthenticated === false) {
      return { visible: false }
    }

    const meetingId = resolveMeetingId(pathname)

    return {
      visible: true,
      authenticated: true,
      allowGlobalToggle: Boolean(meetingId),
      defaultScope: (meetingId ? 'meeting' : 'global') as ChatSurfaceScope,
      meetingId,
    }
  }, [isAuthenticated, pathname])

  if (!config.visible) {
    return null
  }

  const hasMeeting = Boolean(config.meetingId)

  return (
    <ChatBar
      authenticated={config.authenticated}
      allowGlobalToggle={config.allowGlobalToggle}
      defaultScope={config.defaultScope}
      meetingId={config.meetingId}
      transcriptBubble={hasMeeting ? <TranscriptBubble /> : undefined}
    />
  )
}
