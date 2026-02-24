'use client'

import { useState } from 'react'
import { AudioRecorder } from '@/components/audio-recorder'
import { AudioUploader } from '@/components/audio-uploader'
import { ProcessingView } from '@/components/processing-view'
import { cn } from '@/lib/utils'

type Tab = 'record' | 'upload'

export default function NewMeetingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('record')
  const [processing, setProcessing] = useState<{
    meetingId: string
    step: 'transcribing' | 'generating' | 'done' | 'error'
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

      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => setActiveTab('record')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'record'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Record
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'upload'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Upload
        </button>
      </div>

      {/* Content */}
      {activeTab === 'record' ? (
        <AudioRecorder onProcessing={setProcessing} />
      ) : (
        <AudioUploader onProcessing={setProcessing} />
      )}
    </div>
  )
}
