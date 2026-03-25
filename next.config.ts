import type { NextConfig } from 'next'

const config: NextConfig = {
  // Skip ESLint during builds (run separately)
  eslint: { ignoreDuringBuilds: true },
  // Skip TypeScript errors during builds (type-check separately)
  typescript: { ignoreBuildErrors: true },
  // Compress responses
  compress: true,

  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@supabase/supabase-js'],
  },

  // Images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },

  // Headers — aggressive caching for static assets
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/favicon.svg',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ]
  },
}

export default config
