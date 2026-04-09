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
    async function provision(user: any) {
      try {
        await fetch('/api/auth/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id:         user.id,
            email:      user.email,
            name:       user.user_metadata?.full_name
                        ?? user.user_metadata?.name
                        ?? user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url ?? null,
          }),
        })
      } catch (_) {}
    }

    async function handleAuth() {
      // ── Step 1: Read hash BEFORE anything else clears it ──────────────────
      // Supabase's detectSessionInUrl will consume the hash when createClient()
      // first runs, so we must capture it immediately.
      const rawHash   = window.location.hash.slice(1)
      const hashParams = new URLSearchParams(rawHash)

      // Check for explicit error params first
      const errorCode  = hashParams.get('error_code')
      const errorParam = hashParams.get('error')
      if (errorCode === 'otp_expired' || errorParam === 'access_denied') { setState('otp_expired'); return }
      if (errorParam) { setState('error'); return }

      const accessToken  = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      const supabase = createClient()

      // ── Step 2: Try existing session first ─────────────────────────────────
      // detectSessionInUrl may have already processed the hash and stored the
      // session before this effect runs — that's the most common path.
      const { data: { session: existing } } = await supabase.auth.getSession()
      if (existing?.user) {
        await provision(existing.user)
        router.replace(next)
        return
      }

      // ── Step 3: Manually set session from hash tokens ──────────────────────
      // Handles cases where auto-detect hasn't fired yet.
      if (accessToken && refreshToken) {
        const { data: { session }, error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        })
        if (error || !session?.user) {
          console.error('[auth/confirm] setSession failed:', error?.message)
          setState('error')
          return
        }
        await provision(session.user)
        router.replace(next)
        return
      }

      // ── Step 4: Retry with back-off ────────────────────────────────────────
      // Neither hash tokens nor an immediate session — Supabase client may still
      // be initializing. Retry up to 4× (2.4 s total) before giving up.
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise(r => setTimeout(r, 600))
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          await provision(session.user)
          router.replace(next)
          return
        }
      }

      setState('error')
    }

    handleAuth()
  }, [router, next])

  if (state === 'otp_expired') return (
    <div style={outer}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
        <h2 style={h2}>Invite link expired</h2>
        <p style={body}>
          This invite link has expired — links are valid for 24 hours.
          Ask your admin to send a fresh invitation.
        </p>
        <button onClick={() => router.replace('/login')} style={btn}>Back to sign in</button>
        <p style={hint}>Already have an account? Sign in normally — you'll be added to the workspace automatically.</p>
      </div>
    </div>
  )

  if (state === 'error') return (
    <div style={outer}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h2 style={h2}>Sign-in failed</h2>
        <p style={body}>
          We couldn't complete your sign-in. This sometimes happens on the very
          first login — please try signing in again and it should work.
        </p>
        <button onClick={() => router.replace('/login')} style={btn}>Try again</button>
      </div>
    </div>
  )

  return (
    <div style={outer}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }}/>
        <p style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>Signing you in…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

const outer: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: 24,
}
const card: React.CSSProperties  = { background: '#fff', borderRadius: 18, padding: '36px 32px', maxWidth: 420, width: '100%', textAlign: 'center' }
const h2: React.CSSProperties    = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }
const body: React.CSSProperties  = { fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }
const btn: React.CSSProperties   = { width: '100%', padding: '13px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const hint: React.CSSProperties  = { marginTop: 16, fontSize: 12, color: '#94a3b8' }

export default function AuthConfirmPage() {
  const fallback = (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)' }}>
      <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return <Suspense fallback={fallback}><AuthConfirmInner/></Suspense>
}
