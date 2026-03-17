'use client'

import { Component } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { StatusPanel } from '@/components/status-panel'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
}

export class RecordingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  handleReset = () => {
    this.setState({ hasError: false })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <StatusPanel
          tone="destructive"
          icon={<AlertCircle className="text-destructive" />}
          title="Something went wrong with the recording"
          description="An unexpected error occurred. Your audio recorded so far is safe."
          actions={
            <Button onClick={this.handleReset}>Try again</Button>
          }
        />
      )
    }

    return this.props.children
  }
}
