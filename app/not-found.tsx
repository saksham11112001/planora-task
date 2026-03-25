import Link from 'next/link'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: '404 — Page not found' }

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: 'rgba(255,255,255,0.1)', lineHeight: 1, marginBottom: 8 }}>
          404
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0d9488',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 22, fontWeight: 800, color: '#fff' }}>P</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 28, maxWidth: 300, margin: '0 auto 28px' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/dashboard" style={{ background: '#0d9488', color: '#fff', padding: '10px 24px',
          borderRadius: 9, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
