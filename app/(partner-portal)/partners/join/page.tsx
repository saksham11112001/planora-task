'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const ACCENT = '#0d9488'

export default function PartnerJoinPage() {
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [refCode,     setRefCode]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [sent,        setSent]        = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    // Pre-fill ref code from URL if present
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) setRefCode(ref)
    // Pre-fill email from existing Supabase session (if any)
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    setLoading(true); setError('')
    try {
      // Register partner profile first, then send magic link
      const res = await fetch('/api/partner-portal/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null, referred_by: refCode.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Registration failed'); return }

      // Send magic link
      const origin = window.location.origin
      const { error: authErr } = await createClient().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/partners/dashboard`,
          shouldCreateUser: true,
        },
      })
      if (authErr) { setError(authErr.message); return }
      setSent(true)
    } catch { setError('Something went wrong — please try again') }
    finally { setLoading(false) }
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: '#f8fafc', colorScheme: 'light' }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>You're in!</h2>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 8px' }}>
            Welcome to the Partner Program, <strong>{name}</strong>.
          </p>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
            We've sent a sign-in link to <strong>{email}</strong>.<br/>Click it to open your dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: '#f8fafc', colorScheme: 'light' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22 }}>🤝</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Join the Partner Program</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Refer clients, earn commissions. No Planora account needed.</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lblStyle}>Full name *</label>
                <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Rajesh Sharma" autoFocus />
              </div>
              <div>
                <label style={lblStyle}>Email *</label>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label style={lblStyle}>Phone <span style={{ fontWeight: 400, color: '#94a3b8' }}>optional</span></label>
                <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              {refCode && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
                  ✅ Referred by a partner — your account will be linked automatically.
                </div>
              )}
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '16px 0 0' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', marginTop: 24, padding: '12px 0',
                background: loading ? '#94a3b8' : ACCENT,
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Setting up…' : 'Join & get my referral link →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 20 }}>
          Already a partner?{' '}
          <Link href="/partners/login" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Sign in →</Link>
        </p>
      </div>
    </div>
  )
}

const lblStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
  fontSize: 14, color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box',
}
