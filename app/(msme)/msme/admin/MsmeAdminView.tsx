'use client'
import { useEffect, useState } from 'react'

const TEAL   = '#0d9488'
const DARK   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'

const TIER_LABELS: Record<string, string> = {
  free:     'Free',
  pack_20:  'Starter (20)',
  pack_50:  'Standard (50)',
  pack_200: 'Professional (200)',
  pack_250: 'Business (250)',
  pack_500: 'Enterprise (500)',
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  emailed:   'Emailed',
  submitted: 'Submitted',
  not_msme:  'Not MSME',
}

type Summary = {
  total_orgs: number
  paid_orgs: number
  free_orgs: number
  total_vendors: number
  tier_counts: Record<string, number>
  vendor_status: Record<string, number>
}

type OrgRow = {
  org_id: string
  org_name: string
  pack_tier: string
  vendor_limit: number
  paid_at: string | null
  vendor_count: number
  deleted_count: number
  status_breakdown: Record<string, number>
}

export default function MsmeAdminView() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [orgs, setOrgs]       = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    fetch('/api/admin/msme-stats')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setSummary(d.summary)
        setOrgs(d.orgs)
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = orgs.filter(o =>
    !search || o.org_name.toLowerCase().includes(search.toLowerCase()) || o.pack_tier.includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 14 }}>Loading…</div>
  )
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 14 }}>{error}</div>
  )

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", colorScheme: 'light' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: DARK }}>MSME Admin Dashboard</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>Organisation and vendor overview</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Orgs',    value: summary.total_orgs,    color: DARK },
            { label: 'Paid Orgs',     value: summary.paid_orgs,     color: TEAL },
            { label: 'Free Orgs',     value: summary.free_orgs,     color: MUTED },
            { label: 'Total Vendors', value: summary.total_vendors,  color: DARK },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pack tier distribution */}
      {summary && Object.keys(summary.tier_counts).length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: DARK }}>Pack Distribution</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(summary.tier_counts).sort((a, b) => b[1] - a[1]).map(([tier, count]) => (
              <div key={tier} style={{ background: tier === 'free' ? '#f8fafc' : 'rgba(13,148,136,0.08)', border: `1px solid ${tier === 'free' ? BORDER : 'rgba(13,148,136,0.25)'}`, borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: tier === 'free' ? MUTED : TEAL }}>{count}</span>
                <span style={{ color: MUTED, marginLeft: 6 }}>{TIER_LABELS[tier] ?? tier}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor status breakdown */}
      {summary && Object.keys(summary.vendor_status).length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: DARK }}>Vendor Status (all orgs)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Object.entries(summary.vendor_status).map(([status, count]) => (
              <div key={status} style={{ background: '#f8fafc', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: DARK }}>{count}</span>
                <span style={{ color: MUTED, marginLeft: 6 }}>{STATUS_LABELS[status] ?? status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-org table */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DARK }}>Per-Organisation ({filtered.length})</h3>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search org name or pack…"
            style={{ fontSize: 12, padding: '6px 10px', border: `1px solid ${BORDER}`, borderRadius: 6, outline: 'none', width: 200, color: DARK }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Organisation', 'Pack', 'Vendors Used', 'Limit', 'Paid On', 'Status Breakdown'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: MUTED, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.org_id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', color: DARK, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>{o.org_name}</td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                      background: o.pack_tier === 'free' ? '#f1f5f9' : 'rgba(13,148,136,0.1)',
                      color: o.pack_tier === 'free' ? MUTED : TEAL,
                      border: `1px solid ${o.pack_tier === 'free' ? BORDER : 'rgba(13,148,136,0.25)'}`,
                    }}>{TIER_LABELS[o.pack_tier] ?? o.pack_tier}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: DARK, borderBottom: `1px solid ${BORDER}` }}>
                    {o.vendor_count}
                    {o.deleted_count > 0 && <span style={{ color: MUTED, fontSize: 11, marginLeft: 4 }}>+{o.deleted_count} del</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: MUTED, borderBottom: `1px solid ${BORDER}` }}>{o.vendor_limit}</td>
                  <td style={{ padding: '10px 14px', color: MUTED, fontSize: 11, borderBottom: `1px solid ${BORDER}` }}>
                    {o.paid_at ? new Date(o.paid_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(o.status_breakdown).map(([s, c]) => (
                        <span key={s} style={{ fontSize: 11, color: MUTED, background: '#f1f5f9', borderRadius: 4, padding: '1px 6px' }}>
                          {STATUS_LABELS[s] ?? s}: {c}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>No organisations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
