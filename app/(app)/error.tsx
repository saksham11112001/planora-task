'use client'
import { useEffect } from 'react'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[App Error]', error) }, [error])

  async function signOut() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      await sb.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 520 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
          Your workspace couldn't load. Sign out and back in to fix this.
        </p>

        {/* Show actual error message — visible in browser so you can report it */}
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '12px 16px', marginBottom: 12, textAlign: 'left' }}>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#dc2626',
            wordBreak: 'break-all', margin: 0, whiteSpace: 'pre-wrap' }}>
            {error?.message || 'Unknown error'}
          </p>
        </div>

        {/* Stack trace — collapsed */}
        {error?.stack && (
          <details style={{ marginBottom: 16, textAlign: 'left' }}>
            <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer', marginBottom: 6 }}>
              Stack trace
            </summary>
            <pre style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f1f5f9',
              padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
              {error.stack}
            </pre>
          </details>
        )}

        {error?.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginBottom: 24 }}>
            Ref: {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={signOut}
            style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '10px 24px',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign out and sign back in
          </button>
          <button onClick={reset}
            style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db',
              padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
