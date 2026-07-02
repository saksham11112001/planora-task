'use client'
// Catches errors thrown in the ROOT layout itself (which app/error.tsx cannot).
// Reports to Sentry (no-op until DSN set) and renders a minimal standalone shell.
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try { Sentry.captureException(error) } catch { /* ignore */ }
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 440 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
            An unexpected error occurred. Please reload the page.
          </p>
          <a href="/" style={{ background: '#0d9488', color: '#fff', textDecoration: 'none', padding: '10px 24px',
            borderRadius: 8, fontSize: 14, fontWeight: 600, display: 'inline-block' }}>
            Reload
          </a>
        </div>
      </body>
    </html>
  )
}
