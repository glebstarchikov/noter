import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from 'next-themes'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://noter1.vercel.app'),
  title: {
    default: 'noter - AI Meeting Notes',
    template: '%s | noter',
  },
  description: 'Record, transcribe, and generate structured meeting notes with AI. Built for the modern team.',
  keywords: ['meeting notes', 'AI transcription', 'meeting summary', 'audio recording', 'team collaboration'],
  openGraph: {
    title: 'noter - AI Meeting Notes',
    description: 'Record, transcribe, and generate structured meeting notes with AI.',
    siteName: 'noter',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'noter - AI Meeting Notes',
    description: 'Record, transcribe, and generate structured meeting notes with AI.',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: 'bg-card border-border text-card-foreground',
            }}
          />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
