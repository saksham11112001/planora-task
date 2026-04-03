'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthConfirmInner() {
  const router  = useRouter()
  const params  = useSearchParams()
  const next    = params.get('next') ?? '/dashboard'
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const timeout  = setTimeout(() => setError(true), 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        clearTimeout(timeout)

        // Provision public.users row — server callback didn't run for implicit flow
        await fetch('/api/auth/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id:         session.user.id,
            email:      session.user.email,
            name:       session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
          }),
        })

        router.replace(next)
      }
    })

    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [router, next])

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24,
      }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '36px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Sign-in failed</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            We couldn't complete your Google sign-in. This can happen if cookies
            are blocked or the session timed out.
          </p>
          <button onClick={() => router.replace('/login')} style={{
            width: '100%', padding: '13px 16px', background: '#0d9488',
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
          }}>
            Back to sign in
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
            Make sure cookies are enabled in your browser and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)',
    }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>Signing you in…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

// useSearchParams() requires a Suspense boundary in Next.js 15
export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)',
      }}>
        <div style={{
          width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <AuthConfirmInner />
    </Suspense>
  )
}