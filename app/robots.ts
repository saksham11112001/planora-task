import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/(app)/', '/onboarding/', '/auth/'],
      },
    ],
    sitemap: 'https://upfloat.co/sitemap.xml',
  }
}
