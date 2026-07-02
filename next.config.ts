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
      // Baseline security headers on every response.
      // NOTE: intentionally NO Content-Security-Policy — a strict CSP would break
      // the inline theme script, PostHog, Razorpay checkout, and Supabase. Add one
      // later in report-only mode and validate before enforcing.
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS for 2 years across all subdomains (msme.upfloat.co etc.)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Stop browsers guessing content types (MIME-sniffing attacks)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Prevent the app being framed by other sites (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Don't leak full URLs to third-party sites
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deny powerful browser features the app doesn't use
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ]
  },
}

export default config
