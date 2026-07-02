'use client'
// Client-side Sentry initialisation. Mounted once in the root layout.
// No-op until NEXT_PUBLIC_SENTRY_DSN is set, so it's safe to ship immediately.
// (On Next 15.3+ this could move to instrumentation-client.ts; done here for 15.1.)
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (typeof window !== 'undefined' && dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    tracesSampleRate: 0.1,
    // Session replay is off by default — enable later if you want it (costs quota).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: ['NEXT_REDIRECT', 'NEXT_NOT_FOUND', 'ResizeObserver loop'],
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  })
}

export function SentryInit() {
  return null
}
