'use client'
import { useState, useEffect } from 'react'
import { hasAnalyticsConsent, grantAnalyticsConsent, revokeAnalyticsConsent } from './PostHogProvider'

export function CookieConsentBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only show if no decision has been made yet
    if (hasAnalyticsConsent() === null) setShow(true)
  }, [])

  if (!show) return null

  function accept() {
    grantAnalyticsConsent()
    setShow(false)
  }

  function decline() {
    revokeAnalyticsConsent()
    setShow(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        maxWidth: 680, width: 'calc(100vw - 32px)',
        background: '#0f172a', color: '#f8fafc',
        borderRadius: 12, padding: '14px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
        fontSize: 13, lineHeight: 1.5,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <p style={{ margin: 0, flex: 1, color: '#cbd5e1' }}>
        We use cookies and analytics to understand how you use upFloat and improve the product.
        See our{' '}
        <a href="/privacy" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
          Privacy Policy
        </a>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid #475569',
            color: '#94a3b8', fontSize: 13, fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            background: '#0d9488', border: 'none',
            color: '#fff', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
