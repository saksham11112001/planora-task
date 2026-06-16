'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const ACCENT = '#0d9488'

export default function PartnerLoginPage() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your email'); return }
    setLoading(true); setError('')
    try {
      const origin = window.location.origin
      const { error: err } = await createClient().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/partners/dashboard`,
          shouldCreateUser: false,
        },
      })
      if (err) { setError(err.message); return }
      setSent(true)
    } catch { setError('Something went wrong — please try again') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: '#f8fafc', colorScheme: 'light' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22 }}>🤝</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Partner Portal</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Sign in to your partner account</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Check your inbox</h2>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
                We sent a sign-in link to <strong>{email}</strong>.<br/>Click it to access your dashboard.
              </p>
              <button onClick={() => { setSent(false); setEmail('') }}
                style={{ fontSize: 13, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendLink}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
                    fontSize: 14, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
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
                {loading ? 'Sending…' : 'Send sign-in link →'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 20 }}>
          Not a partner yet?{' '}
          <Link href="/partners/join" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Join the program →</Link>
        </p>
      </div>
    </div>
  )
}
