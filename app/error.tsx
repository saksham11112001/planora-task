'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          An unexpected error occurred. Our team has been notified.
          {error.digest && <><br/><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>Ref: {error.digest}</span></>}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset}
            style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '9px 20px',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
          <Link href="/dashboard"
            style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', padding: '9px 20px',
              borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
