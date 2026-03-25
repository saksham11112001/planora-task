'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-subtle)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
          This page ran into an error. Try refreshing or go back to the dashboard.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} style={{ background: '#0d9488', color: '#fff', border: 'none',
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
          <Link href="/dashboard" style={{ background: '#f1f5f9', color: '#374151',
            border: '1px solid #e2e8f0', padding: '8px 18px', borderRadius: 8, fontSize: 13,
            fontWeight: 500, textDecoration: 'none' }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
