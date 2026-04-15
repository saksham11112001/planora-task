'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Mode = 'choose' | 'magic' | 'magic_sent' | 'email_password' | 'email_signup' | 'signup_confirm'

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  )
}

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
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth_failed') {
      setError("Sign-in failed. Please try again — if the problem persists, try a different method.")
      setMode('choose')
    }
  }, [])

  function resetForm(newMode: Mode) {
    setMode(newMode)
    setError('')
    setPassword('')
    setConfirm('')
  }

  // ── Microsoft OAuth ───────────────────────────────────────────────────────
  async function handleMicrosoft() {
    if (loading) return
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/confirm`,
          scopes: 'email profile openid',
        },
      })
      if (e) { setError('Microsoft sign-in failed: ' + e.message); setLoading(false) }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    if (loading) return
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Point directly at the client-side confirm page so the URL hash
          // (#access_token=…) is preserved — server redirects strip the hash.
          redirectTo: `${window.location.origin}/auth/confirm`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (e) { setError('Google sign-in failed: ' + e.message); setLoading(false) }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
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

  // ── Email + password sign-in ──────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim())    { setError('Enter your email address'); return }
    if (!password)        { setError('Enter your password'); return }
    setLoading(true); setError('')

    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (err || !data.user) {
      setLoading(false)
      setError(err?.message ?? 'Sign-in failed. Check your credentials.')
      return
    }

    // Provision user row then navigate
    await provisionUser()
    router.replace('/dashboard')
  }

  // ── Email + password sign-up ──────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim())        { setError('Enter your email address'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    if (password !== confirm)  { setError('Passwords do not match'); return }
    setLoading(true); setError('')

    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (err) {
      setLoading(false)
      setError(err.message)
      return
    }

    // If Supabase auto-confirms (e.g. "confirm email" is disabled in dashboard)
    // we get a session immediately — provision and redirect.
    if (data.session?.user) {
      await provisionUser()
      setLoading(false)
      router.replace('/onboarding')
      return
    }

    // Otherwise email confirmation is required
    setLoading(false)
    setMode('signup_confirm')
  }

  // Calls the server-side provision endpoint to create/update the users row
  async function provisionUser() {
    try {
      await fetch('/api/auth/provision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>P</div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' }}>Taska</span>
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>Project management for modern teams</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '36px 32px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>

          {/* ── Magic link sent ── */}
          {mode === 'magic_sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2 style={h2}>Check your inbox</h2>
              <p style={bodyStyle}>
                We sent a sign-in link to <strong style={{ color: '#0f172a' }}>{email}</strong>.<br/>
                Click the link in the email to continue.
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>
                Didn't get it? Check spam or{' '}
                <button onClick={() => { setMode('magic'); setError('') }}
                  style={{ color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>
                  try again
                </button>
              </p>
            </div>
          )}

          {/* ── Sign-up confirmation ── */}
          {mode === 'signup_confirm' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
              <h2 style={h2}>Confirm your email</h2>
              <p style={bodyStyle}>
                We sent a confirmation link to <strong style={{ color: '#0f172a' }}>{email}</strong>.<br/>
                Click it to activate your account and sign in.
              </p>
              <button onClick={() => resetForm('choose')} style={secondaryBtn}>
                Back to sign in
              </button>
            </div>
          )}

          {/* ── Choose method ── */}
          {mode === 'choose' && (
            <>
              <h1 style={h1}>Welcome to Taska</h1>
              <p style={subStyle}>Sign in or create your free workspace</p>

              {error && <ErrorBox msg={error} />}

              <button onClick={handleGoogle} disabled={loading} style={{ ...primaryBtn, background: '#fff', color: '#374151', border: '1.5px solid #e2e8f0', marginBottom: 12 }}>
                {loading
                  ? <Spinner />
                  : <GoogleIcon />}
                {loading ? 'Connecting...' : 'Continue with Google'}
              </button>

              <button onClick={handleMicrosoft} disabled={loading} style={{ ...primaryBtn, background: '#fff', color: '#374151', border: '1.5px solid #e2e8f0', marginBottom: 12 }}>
                {loading ? <Spinner /> : <MicrosoftIcon />}
                {loading ? 'Connecting...' : 'Continue with Microsoft (Outlook)'}
              </button>

              <Divider />

              <button onClick={() => { setMode('magic'); setError('') }} style={{ ...primaryBtn, background: '#fff', color: '#374151', border: '1.5px solid #e2e8f0', marginBottom: 8 }}>
                ✉ Continue with email link
              </button>

              <button onClick={() => resetForm('email_password')} style={{ ...primaryBtn, background: '#fff', color: '#374151', border: '1.5px solid #e2e8f0' }}>
                🔑 Sign in with password
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
              <BackBtn onClick={() => resetForm('choose')} />
              <h1 style={h1}>Sign in with email</h1>
              <p style={subStyle}>We'll send you a magic link — no password needed</p>

              {error && <ErrorBox msg={error} />}

              <form onSubmit={handleMagicLink}>
                <EmailInput value={email} onChange={setEmail} />
                <SubmitBtn loading={loading} label="Send magic link →" loadingLabel="Sending..." />
              </form>

              <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                Prefer a password?{' '}
                <button onClick={() => resetForm('email_password')}
                  style={{ color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Sign in with password
                </button>
              </p>
            </>
          )}

          {/* ── Email + password sign-in ── */}
          {mode === 'email_password' && (
            <>
              <BackBtn onClick={() => resetForm('choose')} />
              <h1 style={h1}>Sign in</h1>
              <p style={subStyle}>Use your email and password</p>

              {error && <ErrorBox msg={error} />}

              <form onSubmit={handleSignIn}>
                <EmailInput value={email} onChange={setEmail} />
                <PasswordInput
                  placeholder="Password"
                  value={password}
                  onChange={setPassword}
                  style={{ marginBottom: 16 }}
                />
                <SubmitBtn loading={loading} label="Sign in →" loadingLabel="Signing in..." />
              </form>

              <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                Don't have an account?{' '}
                <button onClick={() => resetForm('email_signup')}
                  style={{ color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Create account
                </button>
              </p>
              <p style={{ marginTop: 8, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                Forgot password?{' '}
                <button onClick={() => resetForm('magic')}
                  style={{ color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Get a magic link
                </button>
              </p>
            </>
          )}

          {/* ── Email + password sign-up ── */}
          {mode === 'email_signup' && (
            <>
              <BackBtn onClick={() => resetForm('email_password')} />
              <h1 style={h1}>Create account</h1>
              <p style={subStyle}>Set up your Taska account</p>

              {error && <ErrorBox msg={error} />}

              <form onSubmit={handleSignUp}>
                <EmailInput value={email} onChange={setEmail} />
                <PasswordInput
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={setPassword}
                  style={{ marginBottom: 8 }}
                />
                <PasswordInput
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={setConfirm}
                  style={{ marginBottom: 16 }}
                />
                <SubmitBtn loading={loading} label="Create account →" loadingLabel="Creating account..." />
              </form>

              <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                Already have an account?{' '}
                <button onClick={() => resetForm('email_password')}
                  style={{ color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Sign in
                </button>
              </p>
            </>
          )}

        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 24 }}>
          © 2025 SNG Advisors · Taska · Made in India 🇮🇳
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }}/>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
        fontSize: 13, padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center',
        gap: 4, fontFamily: 'inherit' }}>
      ← Back
    </button>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2',
      border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
      {msg}
    </div>
  )
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>or</span>
      <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ width: 18, height: 18, border: '2px solid #e2e8f0',
      borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
  )
}

function EmailInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="email" value={value} onChange={e => onChange(e.target.value)}
      placeholder="you@company.com" required autoFocus
      style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0',
        borderRadius: 10, fontSize: 14, color: '#0f172a', outline: 'none',
        marginBottom: 8, boxSizing: 'border-box', transition: 'border-color 0.15s',
        fontFamily: 'inherit' }}
      onFocus={e => e.target.style.borderColor = '#0d9488'}
      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
    />
  )
}

function PasswordInput({ value, onChange, placeholder, style: extraStyle }: {
  value: string; onChange: (v: string) => void; placeholder: string; style?: React.CSSProperties
}) {
  return (
    <input
      type="password" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required
      style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0',
        borderRadius: 10, fontSize: 14, color: '#0f172a', outline: 'none',
        boxSizing: 'border-box', transition: 'border-color 0.15s',
        fontFamily: 'inherit', ...extraStyle }}
      onFocus={e => e.target.style.borderColor = '#0d9488'}
      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
    />
  )
}

function SubmitBtn({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button type="submit" disabled={loading}
      style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8,
        background: loading ? '#94a3b8' : '#0d9488',
        color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
        fontFamily: 'inherit' }}>
      {loading && <Spinner />}
      {loading ? loadingLabel : label}
    </button>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────

const h1: React.CSSProperties         = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }
const h2: React.CSSProperties         = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }
const subStyle: React.CSSProperties   = { fontSize: 14, color: '#64748b', marginBottom: 24 }
const bodyStyle: React.CSSProperties  = { fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }
const primaryBtn: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 12, padding: '13px 16px', borderRadius: 10, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
}
const secondaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 16px', background: '#f8fafc', color: '#374151',
  border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
}
