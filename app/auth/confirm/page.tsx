'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MSME_URL = process.env.NEXT_PUBLIC_MSME_URL ?? 'https://msme.upfloat.co'

// Cross-subdomain redirect helper: if next=/msme and we're on the main domain,
// use a full-page navigation to the MSME subdomain.
function navigateToNext(next: string, router: ReturnType<typeof import('next/navigation').useRouter>) {
  if (next === '/msme' && typeof window !== 'undefined' && !window.location.hostname.startsWith('msme.')) {
    window.location.replace(`${MSME_URL}/msme`)
    return
  }
  router.replace(next)
}

type State = 'loading' | 'set_password' | 'otp_expired' | 'cancelled' | 'error'

function AuthConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next   = params.get('next') ?? '/dashboard'
  const [state,      setState]      = useState<State>('loading')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [pwError,    setPwError]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    async function handleAuth() {
      // If a PKCE ?code= landed here by mistake (e.g. OAuth redirectTo misconfiguration),
      // forward it to the server-side callback route which knows how to exchange it.
      const queryCode = new URLSearchParams(window.location.search).get('code')
      if (queryCode) {
        const fwd = new URL('/auth/callback', window.location.origin)
        fwd.searchParams.set('code', queryCode)
        if (next !== '/dashboard') fwd.searchParams.set('next', next)
        window.location.replace(fwd.toString())
        return
      }

      const hash       = window.location.hash.slice(1)
      const hashParams = new URLSearchParams(hash)

      // Check for errors first
      const errorCode  = hashParams.get('error_code')
      const errorParam = hashParams.get('error')
      if (errorCode === 'otp_expired') { setState('otp_expired'); return }
      if (errorParam === 'access_denied') { setState('cancelled'); return }
      if (errorParam) { setState('error'); return }

      const accessToken  = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      // 'invite' type comes from Supabase's inviteUserByEmail link
      const tokenType    = hashParams.get('type')

      if (!accessToken || !refreshToken) {
        const supabase = createClient()
        await new Promise(r => setTimeout(r, 800))
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          await provision(session.user)
          navigateToNext(next, router)
        } else {
          setState('error')
        }
        return
      }

      const supabase = createClient()
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

      // Invite and password-reset links: prompt user to set/update their password
      // so they can log in independently without needing email delivery each time.
      if (tokenType === 'invite' || tokenType === 'recovery') {
        setIsRecovery(tokenType === 'recovery')
        setState('set_password')
        return
      }

      navigateToNext(next, router)
    }

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
      } catch (e) { console.warn('[auth/confirm] provision fetch failed:', e) }
    }

    handleAuth()
  }, [router, next])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (password.length < 8) { setPwError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setPwError('Passwords do not match'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setPwError(error.message); return }
    navigateToNext(next, router)
  }

  // ── Set password screen (shown after invite link) ──────────────────────
  if (state === 'set_password') {
    return (
      <div style={outer}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
          <h2 style={h2}>{isRecovery ? 'Set new password' : 'Set your password'}</h2>
          <p style={body}>
            {isRecovery
              ? 'Choose a new password for your account.'
              : 'Create a password so you can sign in anytime — even if email delivery is slow.'}
          </p>

          {pwError && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', textAlign: 'left' }}>
              {pwError}
            </div>
          )}

          <form onSubmit={handleSetPassword}>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="New password (min 8 characters)" required autoFocus
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#0d9488'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm password" required
              style={{ ...inputStyle, marginBottom: 20 }}
              onFocus={e => e.target.style.borderColor = '#0d9488'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <button type="submit" disabled={saving} style={primaryBtn}>
              {saving ? 'Saving…' : 'Set password & continue →'}
            </button>
          </form>

          {!isRecovery && (
            <button
              onClick={() => navigateToNext(next, router)}
              style={{ marginTop: 12, width: '100%', padding: '11px 16px', background: 'transparent',
                color: '#94a3b8', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip for now
            </button>
          )}

          <p style={{ ...hint, marginTop: 14 }}>
            You can always set or change your password later from your profile settings.
          </p>
        </div>
      </div>
    )
  }

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
          <button onClick={() => router.replace('/login')} style={primaryBtn}>Back to sign in</button>
          <p style={hint}>Already have an account? Sign in normally — you'll be added to the workspace automatically.</p>
        </div>
      </div>
    )
  }

  if (state === 'cancelled') {
    return (
      <div style={outer}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✋</div>
          <h2 style={h2}>Sign-in cancelled</h2>
          <p style={body}>
            You cancelled the sign-in. No worries — click below to try again.
          </p>
          <button onClick={() => router.replace('/login')} style={primaryBtn}>Back to sign in</button>
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
            We couldn't complete your sign-in. This can happen if the link expired or was already used.
          </p>
          <button onClick={() => router.replace('/login')} style={primaryBtn}>Back to sign in</button>
          <p style={{ ...hint, marginTop: 12 }}>
            Tip: Try signing in with Google directly — it's the fastest option.
          </p>
        </div>
      </div>
    )
  }

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

const outer: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: 24,
}
const card: React.CSSProperties  = { background: '#fff', borderRadius: 18, padding: '36px 32px', maxWidth: 420, width: '100%', textAlign: 'center' }
const h2: React.CSSProperties    = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }
const body: React.CSSProperties  = { fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }
const hint: React.CSSProperties  = { marginTop: 16, fontSize: 12, color: '#94a3b8' }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0',
  borderRadius: 10, fontSize: 14, color: '#0f172a', outline: 'none',
  marginBottom: 10, boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 16px', background: '#0d9488', color: '#fff',
  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

export default function AuthConfirmPage() {
  const fallback = (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)' }}>
      <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return <Suspense fallback={fallback}><AuthConfirmInner /></Suspense>
}
