'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[App Error]', error)
    // Without this, workspace crashes were never reported — we debugged blind.
    try { Sentry.captureException(error) } catch { /* ignore */ }
  }, [error])

  async function signOut() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      // scope 'local': clear THIS browser only — the global default would
      // revoke the user's sessions on every device.
      await sb.auth.signOut({ scope: 'local' })
    } finally {
      // Corrupted duplicate cookies (host-only + domain-scoped) have been the
      // top cause of unrecoverable "couldn't load" loops. Clear both variants
      // of the org cookie so signing back in starts from a clean slate.
      document.cookie = 'upfloat_active_org=; Path=/; Max-Age=0'
      document.cookie = 'upfloat_active_org=; Path=/; Max-Age=0; Domain=.upfloat.co'
      window.location.href = '/login'
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-subtle)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 440 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
          Your workspace couldn't load. This is usually fixed by signing out and back in.
          If the problem persists, please contact support.
        </p>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginBottom: 24 }}>
            Error ref: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={signOut}
            style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '10px 24px',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out and sign back in
          </button>
          <button onClick={reset}
            style={{ background: 'var(--surface-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border)',
              padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
