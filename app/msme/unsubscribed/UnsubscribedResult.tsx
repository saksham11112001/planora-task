'use client'
import { useSearchParams } from 'next/navigation'

export default function UnsubscribedResult() {
  const params = useSearchParams()
  const status = params.get('status')
  const name   = params.get('name') ?? ''
  const ok     = status === 'ok'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '24px 16px',
    }}>
      <div style={{
        maxWidth: 440, width: '100%', background: '#fff',
        borderRadius: 16, border: '1px solid #e2e8f0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '40px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>{ok ? '✅' : '⚠️'}</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
          {ok ? 'You\'ve been unsubscribed' : 'Invalid link'}
        </h1>
        {name && ok && (
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#64748b' }}>
            <strong>{name}</strong>
          </p>
        )}
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
          {ok
            ? 'We\'ve removed your email address from our MSME compliance list. You won\'t receive any more emails from us regarding this compliance request.'
            : 'This unsubscribe link is no longer valid. If you still wish to opt out, please reply to the email and ask to be removed.'}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
          Powered by upFloat
        </p>
      </div>
    </div>
  )
}
