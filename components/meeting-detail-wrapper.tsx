'use client'

import { UnifiedMeetingPage } from '@/components/unified-meeting-page'
import { PageShell } from '@/components/page-shell'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({ meeting }: { meeting: Meeting }) {
  return (
    <PageShell size="detail">
      <UnifiedMeetingPage meeting={meeting} />
    </PageShell>
  )
}
