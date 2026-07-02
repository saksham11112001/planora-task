// Next.js instrumentation hook — runs once when the server process starts.
// Loads the correct Sentry config for the active runtime and wires the
// App Router server-error hook so failed Server Components / Route Handlers
// are reported. Entirely inert until NEXT_PUBLIC_SENTRY_DSN is configured.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captures errors thrown in Server Components, Route Handlers, and middleware.
export const onRequestError = Sentry.captureRequestError
