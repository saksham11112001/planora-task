'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type State = 'loading' | 'form' | 'no_session'

function ResetPasswordInner() {
  const router = useRouter()
  const [state,    setState]    = useState<State>('loading')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setState(session?.user ? 'form' : 'no_session')
    }
    checkSession()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) { setError(err.message); return }
    // Subdomain-aware redirect so MSME users land back in /msme
    router.replace(window.location.hostname.startsWith('msme.') ? '/msme' : '/dashboard')
  }

  if (state === 'loading') {
    return (
      <div style={outer}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (state === 'no_session') {
    return (
      <div style={outer}>
        <div style={card}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={h2}>Link expired or already used</h2>
          <p style={body}>
            This password reset link is no longer valid. Links expire after a short time or once used.
            Please request a new one.
          </p>
          <button onClick={() => router.replace('/login')} style={primaryBtn}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={outer}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
        <h2 style={h2}>Set new password</h2>
        <p style={body}>Choose a strong password for your account.</p>

        {error && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            required
            autoFocus
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#0d9488'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            required
            style={{ ...inputStyle, marginBottom: 20 }}
            onFocus={e => e.target.style.borderColor = '#0d9488'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />
          <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Set new password →'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
          You can change your password again any time from your profile settings.
        </p>
      </div>
    </div>
  )
}

const outer: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: 24,
}
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: '36px 32px',
  maxWidth: 420, width: '100%', textAlign: 'center',
  boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
}
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }
const body: React.CSSProperties = { fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0',
  borderRadius: 10, fontSize: 14, color: '#0f172a', outline: 'none',
  marginBottom: 10, boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 16px', background: '#0d9488', color: '#fff',
  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
  fontFamily: 'inherit', display: 'block',
}

const fallback = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)' }}>
    <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
)

export default function ResetPasswordPage() {
  return <Suspense fallback={fallback}><ResetPasswordInner /></Suspense>
}
