import type { NextConfig } from 'next'

const config: NextConfig = {
  // Resolve workspace-root detection warning caused by multiple lockfiles on the machine.
  // Set to the project directory so Next.js traces files correctly.
  outputFileTracingRoot: __dirname,

  // Skip ESLint during builds (run separately)
  eslint: { ignoreDuringBuilds: true },
  // Skip TypeScript errors during builds (type-check separately)
  typescript: { ignoreBuildErrors: true },
  // Compress responses
  compress: true,

  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@supabase/supabase-js'],
    // Keep at 0 — auth layout reads session cookies on every request.
    // Caching dynamic pages could serve stale org/session data to the wrong user.
    staleTimes: { dynamic: 0 },
  },

  // xlsx uses native Node.js modules — prevent webpack from bundling it
  serverExternalPackages: ['xlsx'],

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
