// Sentry — edge runtime initialisation (middleware, edge routes).
// Loaded by instrumentation.ts. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: dsn ? 0.1 : 0,
  ignoreErrors: ['NEXT_REDIRECT', 'NEXT_NOT_FOUND'],
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
})
