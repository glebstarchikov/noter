'use client'

import { useState } from 'react'
import { AudioRecorder } from '@/components/audio-recorder'
import { AudioUploader } from '@/components/audio-uploader'
import { ProcessingView } from '@/components/processing-view'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { MeetingStatus } from '@/lib/types'

export default function NewMeetingPage() {
  const [processing, setProcessing] = useState<{
    meetingId: string
    step: MeetingStatus
    error?: string
  } | null>(null)

  if (processing) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">
            Processing meeting
          </h1>
          <p className="text-sm text-muted-foreground">
            Your audio is being analyzed by AI.
          </p>
        </div>
        <ProcessingView
          meetingId={processing.meetingId}
          step={processing.step}
          error={processing.error}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">
          New meeting
        </h1>
        <p className="text-sm text-muted-foreground">
          Record live audio or upload an existing file.
        </p>
      </div>

      <Tabs defaultValue="record">
        <TabsList>
          <TabsTrigger value="record">Record</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          <AudioRecorder onProcessing={setProcessing} />
        </TabsContent>

        <TabsContent value="upload">
          <AudioUploader onProcessing={setProcessing} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
