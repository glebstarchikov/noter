'use client'

import { MeetingDetail } from '@/components/meeting-detail'
import type { Meeting } from '@/lib/types'

export function MeetingDetailWrapper({
    meeting,
}: {
    meeting: Meeting
    meetingId: string
}) {
    return (
        <div className="flex h-full">
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-6 p-6 md:p-10">
                    <MeetingDetail meeting={meeting} />
                </div>
            </div>
        </div>
    )
}
