import type { MetadataRoute } from 'next'
import { SIGNUP_DISABLED } from '@/lib/auth/signup-config'

export default function sitemap(): MetadataRoute.Sitemap {
    const base: MetadataRoute.Sitemap = [
        {
            url: 'https://noter1.vercel.app',
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: 'https://noter1.vercel.app/auth/login',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ]

    if (!SIGNUP_DISABLED) {
        base.push({
            url: 'https://noter1.vercel.app/auth/sign-up',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        })
    }

    return base
}
