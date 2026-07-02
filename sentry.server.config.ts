// Sentry — server runtime (Node.js) initialisation.
// Loaded by instrumentation.ts. No-op until NEXT_PUBLIC_SENTRY_DSN is set,
// so this is completely safe to ship before you've created a Sentry project.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  // Sample 10% of transactions for performance monitoring — tune after launch.
  tracesSampleRate: dsn ? 0.1 : 0,
  // Send less noise from expected control-flow errors.
  ignoreErrors: ['NEXT_REDIRECT', 'NEXT_NOT_FOUND'],
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
})
