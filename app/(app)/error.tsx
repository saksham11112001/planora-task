'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  useEffect(() => { console.error('[App Error]', error) }, [error])

  async function handleLogout() {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 440 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 8, lineHeight: 1.6 }}>
          An unexpected error occurred loading your workspace.
        </p>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', marginBottom: 24 }}>
            Ref: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={reset}
            style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '9px 20px',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Try again
          </button>
          <Link href="/dashboard"
            style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', padding: '9px 20px',
              borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>
            Go to dashboard
          </Link>
        </div>
        <button onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13,
            cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
          Sign out and sign back in
        </button>
      </div>
    </div>
  )
}
