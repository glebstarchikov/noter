import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'noter - AI Meeting Notes',
        short_name: 'noter',
        description: 'Record, transcribe, and generate structured meeting notes with AI.',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#171717',
        theme_color: '#171717',
    }
}
