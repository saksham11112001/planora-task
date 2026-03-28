'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const sessionExpired = params?.get('error') === 'session_expired'
  const authFailed     = params?.get('error') === 'auth_failed'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [showMagic, setShowMagic] = useState(false)

  /* ── Google OAuth ── */
  async function handleGoogle() {
    if (loading) return
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (e) { setError('Google sign-in failed: ' + e.message); setLoading(false) }
    } catch { setError('Something went wrong.'); setLoading(false) }
  }

  /* ── Email + password ── */
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    const trimEmail = email.trim()
    if (!trimEmail)        { setError('Enter your email address'); return }
    if (!password.trim())  { setError('Enter your password'); return }
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error: e } = await supabase.auth.signInWithPassword({
        email: trimEmail, password,
      })
      if (e) {
        // friendly messages
        if (e.message.toLowerCase().includes('invalid'))
          setError('Incorrect email or password. Please try again.')
        else if (e.message.toLowerCase().includes('email'))
          setError('Please check your email address.')
        else
          setError(e.message)
      } else {
        window.location.href = '/dashboard'
      }
    } catch { setError('Something went wrong. Please try again.') }
    setLoading(false)
  }

  /* ── Magic link ── */
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your email address'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setMagicSent(true)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 9,
    border: '1.5px solid #e2e8f0', fontSize: 14,
    boxSizing: 'border-box', fontFamily: 'inherit',
    outline: 'none', color: '#0f172a', background: '#fff',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', background: '#0f172a',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: '#0d9488',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 18 }}>P</div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>Planora</span>
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: 0 }}>
            Project management for modern teams
          </p>
        </div>

        {/* Banners */}
        {authFailed && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10,
            padding: '11px 16px', marginBottom: 14, textAlign: 'center',
            color: '#9a3412', fontSize: 13, fontWeight: 500 }}>
            Sign-in was interrupted. Please try again.
          </div>
        )}
        {sessionExpired && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '11px 16px', marginBottom: 14, textAlign: 'center',
            color: '#991b1b', fontSize: 13, fontWeight: 500 }}>
            Your session expired. Please sign in again.
          </div>
        )}

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '32px 28px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}>

          {magicSent ? (
            /* ── Magic link sent state ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📬</div>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Check your inbox
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65, marginBottom: 20 }}>
                We sent a sign-in link to{' '}
                <strong style={{ color: '#0f172a' }}>{email}</strong>.
                <br/>Click it to continue.
              </p>
              <button onClick={() => { setMagicSent(false); setShowMagic(false); setError('') }}
                style={{ fontSize: 13, color: '#0d9488', background: 'none', border: 'none',
                  cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                ← Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                Welcome to Planora
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 22 }}>
                Sign in or create your free workspace
              </p>

              {/* Google */}
              <button onClick={handleGoogle} disabled={loading}
                style={{ width: '100%', padding: '11px 16px', border: '1.5px solid #e2e8f0',
                  borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#374151',
                  background: '#fff', cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 10, marginBottom: 16,
                  opacity: loading ? 0.7 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#0d9488')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}>
                <GoogleIcon/>
                Continue with Google
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: '#f1f5f9' }}/>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#f1f5f9' }}/>
              </div>

              {/* ── Email + Password form (always visible) ── */}
              {!showMagic ? (
                <form onSubmit={handlePassword} autoComplete="on">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    autoComplete="email"
                    onChange={e => setEmail(e.target.value)}
                    style={{ ...inp, marginBottom: 10 }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#0d9488')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    autoComplete="current-password"
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inp, marginBottom: error ? 10 : 16 }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#0d9488')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                  />

                  {error && (
                    <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12,
                      background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: 7, padding: '8px 12px' }}>
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={loading}
                    style={{ width: '100%', padding: '12px', borderRadius: 9, border: 'none',
                      background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
                      marginBottom: 14 }}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>

                  <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: 0 }}>
                    No password?{' '}
                    <button type="button"
                      onClick={() => { setShowMagic(true); setError('') }}
                      style={{ color: '#0d9488', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        fontFamily: 'inherit', padding: 0 }}>
                      Send me a magic link
                    </button>
                  </p>
                </form>
              ) : (
                /* ── Magic link form ── */
                <form onSubmit={handleMagicLink}>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                    We'll email you a one-click sign-in link — no password needed.
                  </p>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    autoComplete="email"
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                    style={{ ...inp, marginBottom: error ? 10 : 16 }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#0d9488')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
                  />
                  {error && (
                    <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12,
                      background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: 7, padding: '8px 12px' }}>
                      {error}
                    </p>
                  )}
                  <button type="submit" disabled={loading}
                    style={{ width: '100%', padding: '12px', borderRadius: 9, border: 'none',
                      background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      opacity: loading ? 0.7 : 1, marginBottom: 14 }}>
                    {loading ? 'Sending…' : 'Send magic link'}
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: 0 }}>
                    Have a password?{' '}
                    <button type="button"
                      onClick={() => { setShowMagic(false); setError('') }}
                      style={{ color: '#0d9488', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        fontFamily: 'inherit', padding: 0 }}>
                      Sign in with password
                    </button>
                  </p>
                </form>
              )}

              {/* Footer */}
              <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8',
                marginTop: 20, marginBottom: 0 }}>
                By signing in you agree to our{' '}
                <Link href="/terms" style={{ color: '#0d9488' }}>Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" style={{ color: '#0d9488' }}>Privacy Policy</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
