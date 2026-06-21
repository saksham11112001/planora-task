'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

const ACCENT = '#0d9488'

function PartnerLoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [info,     setInfo]     = useState('')

  useEffect(() => {
    if (params.get('registered') === '1') {
      setInfo('Account created! Please check your email to confirm your address, then sign in.')
    }
    if (params.get('already') === '1') {
      setInfo('You already have a partner account. Please sign in below.')
    }
  }, [params])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim())  { setError('Enter your email'); return }
    if (!password)      { setError('Enter your password'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await createClient().auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      })
      if (err) { setError(err.message); return }
      router.push('/partners/dashboard')
    } catch { setError('Something went wrong — please try again') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: '#f8fafc', colorScheme: 'light' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22 }}>🤝</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Partner Portal</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Sign in to your partner account</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {info && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534', marginBottom: 20 }}>
              {info}
            </div>
          )}
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: 16 }}>
              <label style={lblStyle}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lblStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0', background: loading ? '#94a3b8' : ACCENT,
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 20 }}>
          Not a partner yet?{' '}
          <Link href="/partners/join" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Join the program →</Link>
        </p>
      </div>
    </div>
  )
}

export default function PartnerLoginPage() {
  return (
    <Suspense>
      <PartnerLoginInner />
    </Suspense>
  )
}

const lblStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
  fontSize: 14, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box',
}
