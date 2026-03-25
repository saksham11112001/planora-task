import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Planora — Project Management',
    short_name:       'Planora',
    description:      'Project management for modern teams',
    start_url:        '/dashboard',
    display:          'standalone',
    background_color: '#0f172a',
    theme_color:      '#0d9488',
    orientation:      'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
