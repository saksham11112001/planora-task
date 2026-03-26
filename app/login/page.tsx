'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Mode = 'choose' | 'magic' | 'magic_sent'

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
  const router = useRouter()
  const [mode,     setMode]     = useState<Mode>('choose')
  const [email,    setEmail]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)
  const [error,    setError]    = useState('')

  // Auto-redirect if already logged in
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    })

    // Also listen for auth state changes (handles callback redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        router.replace('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

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
      // Don't setLoading(false) on success — page will redirect
    } catch (err: any) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

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

  // Show minimal loading state while checking session
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.2)',
          borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }}/>
      </div>
    )
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
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Welcome to Planora</h1>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Sign in or create your free workspace</p>

              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              {/* Google */}
              <button onClick={handleGoogle} disabled={loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  padding: '13px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontWeight: 500,
                  color: '#374151', background: loading ? '#f8fafc' : '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                  marginBottom: 12, transition: 'all 0.15s', opacity: loading ? 0.7 : 1 }}>
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
                style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  fontSize: 14, fontWeight: 500, color: '#374151', background: '#fff', cursor: 'pointer',
                  transition: 'all 0.15s' }}>
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

      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }}/>
    </div>
  )
}
