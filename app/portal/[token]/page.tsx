export const dynamic = 'force-dynamic'
import { createAdminClient }  from '@/lib/supabase/admin'
import { PortalView }         from './PortalView'
import crypto                 from 'crypto'
import type { Metadata }      from 'next'

export const metadata: Metadata = { title: 'Client Portal — Taska' }

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  const { data: tokenRow } = await admin
    .from('client_portal_tokens')
    .select('id, org_id, client_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return <ExpiredPage />
  }

  return <PortalView rawToken={rawToken} />
}

function ExpiredPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '24px',
    }}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          Link Expired or Invalid
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
          This portal link is no longer active. Please contact your CA firm to get a fresh link.
        </p>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Powered by Taska</div>
      </div>
    </div>
  )
}
