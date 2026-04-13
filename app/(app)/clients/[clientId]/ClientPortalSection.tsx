'use client'
import { useState } from 'react'
import { Link2, Copy, RefreshCw, Trash2, Check, ExternalLink } from 'lucide-react'

interface TokenMeta {
  id: string
  expires_at: string
  created_at: string
  is_expired: boolean
}

interface Props {
  clientId: string
  initialToken: TokenMeta | null
}

export function ClientPortalSection({ clientId, initialToken }: Props) {
  const [token, setToken]       = useState<TokenMeta | null>(initialToken)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ca/portal-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setPortalUrl(data.token_url)
      setToken({ id: '', expires_at: data.expires_at, created_at: new Date().toISOString(), is_expired: false })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function revoke() {
    if (!confirm('Revoke this portal link? The client will no longer be able to access their portal with the current URL.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ca/portal-token', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) throw new Error('Failed to revoke')
      setToken(null)
      setPortalUrl(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function copyUrl() {
    const url = portalUrl
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasActive = token && !token.is_expired
  const expiryLabel = token
    ? new Date(token.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div style={{
      border:       '1px solid var(--border)',
      borderRadius: '12px',
      padding:      '20px',
      background:   'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'rgba(217,119,6,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Link2 size={15} style={{ color: '#d97706' }} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Client Portal</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Share a magic link so the client can view compliance status and upload documents</div>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {hasActive ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '12px', fontWeight: 600, color: '#16a34a',
              background: 'rgba(22,163,74,0.1)', padding: '3px 10px', borderRadius: '20px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              Active
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Expires {expiryLabel}</span>
          </div>

          {portalUrl && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--surface-subtle)', borderRadius: '8px',
              border: '1px solid var(--border)', padding: '8px 12px', marginBottom: '12px',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {portalUrl}
              </span>
              <button
                onClick={copyUrl}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: copied ? '#16a34a' : 'var(--text-muted)', flexShrink: 0 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {portalUrl && (
              <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#0d9488', textDecoration: 'none', padding: '6px 12px', border: '1px solid #0d9488', borderRadius: '6px' }}>
                <ExternalLink size={12} /> Preview
              </a>
            )}
            <button
              onClick={generate}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
              <RefreshCw size={12} /> Regenerate
            </button>
            <button
              onClick={revoke}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#dc2626', background: 'none', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', marginLeft: 'auto' }}>
              <Trash2 size={12} /> Revoke
            </button>
          </div>
        </div>
      ) : (
        <div>
          {token?.is_expired && (
            <p style={{ fontSize: '13px', color: '#ca8a04', marginBottom: '10px' }}>
              The previous link expired on {expiryLabel}.
            </p>
          )}
          <button
            onClick={generate}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 600, color: '#fff',
              background: loading ? '#6b7280' : '#d97706',
              border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer',
            }}>
            <Link2 size={14} />
            {loading ? 'Generating…' : 'Generate portal link'}
          </button>
        </div>
      )}
    </div>
  )
}
