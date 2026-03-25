'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Mode = 'choose' | 'magic' | 'magic_sent'

export default function LoginPage() {
  const [mode,    setMode]    = useState<Mode>('choose')
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (e) { setError('Google sign-in failed: ' + e.message); setLoading(false) }
  }

  // ── Magic link ────────────────────────────────────────────────────────────
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
    setMode('magic_sent')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
      background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>P</div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' }}>Planora</span>
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>Project management for modern teams</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '36px 32px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>

          {/* ── Magic link sent ── */}
          {mode === 'magic_sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Check your inbox</h2>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
                We sent a sign-in link to <strong style={{ color: '#0f172a' }}>{email}</strong>.<br/>
                Click the link in the email to continue.
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>Didn't get it? Check spam or{' '}
                <button onClick={() => { setMode('magic'); setError('') }} style={{ color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>try again</button>
              </p>
            </div>
          )}

          {/* ── Choose method ── */}
          {mode === 'choose' && (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Welcome back</h1>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Sign in to your workspace</p>

              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              {/* Google */}
              <button onClick={handleGoogle} disabled={loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontWeight: 500,
                  color: '#374151', background: '#fff', cursor: 'pointer', marginBottom: 12, transition: 'all 0.15s' }}>
                {loading
                  ? <div style={{ width: 18, height: 18, border: '2px solid #e2e8f0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
                  : <GoogleIcon />}
                {loading ? 'Connecting...' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>or</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
              </div>

              {/* Magic link */}
              <button onClick={() => { setMode('magic'); setError('') }}
                style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  fontSize: 14, fontWeight: 500, color: '#374151', background: '#fff', cursor: 'pointer' }}>
                ✉ Continue with email link
              </button>

              <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                By signing in you agree to our{' '}
                <a href="#" style={{ color: '#0d9488' }}>Terms</a> and{' '}
                <a href="#" style={{ color: '#0d9488' }}>Privacy Policy</a>
              </p>
            </>
          )}

          {/* ── Magic link form ── */}
          {mode === 'magic' && (
            <>
              <button onClick={() => { setMode('choose'); setError('') }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Back
              </button>

              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Sign in with email</h1>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>We'll send you a magic link — no password needed</p>

              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleMagicLink}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required autoFocus
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10,
                    fontSize: 14, color: '#0f172a', outline: 'none', marginBottom: 12, boxSizing: 'border-box',
                    transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '13px 16px', background: loading ? '#94a3b8' : '#0d9488',
                    color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                  {loading ? 'Sending...' : 'Send magic link →'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 24 }}>
          © 2025 SNG Advisors · Planora · Made in India 🇮🇳
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        button:hover:not(:disabled) { opacity: 0.9 }
      `}</style>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
