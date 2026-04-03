'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type State = 'loading' | 'otp_expired' | 'error'

function AuthConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next   = params.get('next') ?? '/dashboard'
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    async function handleAuth() {
      // First check: is there an error in the hash?
      const hash       = window.location.hash.slice(1)
      const hashParams = new URLSearchParams(hash)
      const errorCode  = hashParams.get('error_code')
      const errorParam = hashParams.get('error')

      if (errorCode === 'otp_expired' || errorParam === 'access_denied') {
        setState('otp_expired')
        return
      }
      if (errorParam) {
        setState('error')
        return
      }

      // There's a valid token in the hash — Supabase JS will pick it up
      // via detectSessionInUrl. We poll getSession() until it resolves.
      const supabase = createClient()

      // Give Supabase JS time to parse the hash and set the session
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 300))
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Session established — provision the user row and proceed
          await fetch('/api/auth/provision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id:         session.user.id,
              email:      session.user.email,
              name:       session.user.user_metadata?.full_name
                          ?? session.user.user_metadata?.name
                          ?? session.user.email?.split('@')[0],
              avatar_url: session.user.user_metadata?.avatar_url ?? null,
            }),
          })
          router.replace(next)
          return
        }
      }

      // 6 seconds passed, still no session
      setState('error')
    }

    handleAuth()
  }, [router, next])

  if (state === 'otp_expired') {
    return (
      <div style={outer}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
          <h2 style={h2}>Invite link expired</h2>
          <p style={body}>
            This invite link has expired — links are valid for 24 hours.
            Ask your admin to send a fresh invitation.
          </p>
          <button onClick={() => router.replace('/login')} style={btn}>
            Back to sign in
          </button>
          <p style={hint}>Already have an account? Sign in normally and you'll be added to the workspace.</p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={outer}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={h2}>Sign-in failed</h2>
          <p style={body}>
            We couldn't establish your session. Please try clicking the invite
            link again, or ask your admin to resend the invitation.
          </p>
          <button onClick={() => router.replace('/login')} style={btn}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // Loading spinner
  return (
    <div style={outer}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>Signing you in…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const outer: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: 24,
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: '36px 32px',
  maxWidth: 420, width: '100%', textAlign: 'center',
}
const h2: React.CSSProperties  = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }
const body: React.CSSProperties = { fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }
const btn: React.CSSProperties  = {
  width: '100%', padding: '13px 16px', background: '#0d9488',
  color: '#fff', border: 'none', borderRadius: 10, fontSize: 14,
  fontWeight: 600, cursor: 'pointer',
}
const hint: React.CSSProperties = { marginTop: 16, fontSize: 12, color: '#94a3b8' }

// ── Suspense wrapper (required by Next.js 15 for useSearchParams) ─────────
export default function AuthConfirmPage() {
  const fallback = (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)' }}>
      <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return <Suspense fallback={fallback}><AuthConfirmInner /></Suspense>
}