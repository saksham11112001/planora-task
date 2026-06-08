'use client'
import { useState } from 'react'

interface ClientDSC {
  id: string; name: string; color: string; email?: string | null; phone?: string | null
  dsc_expiry_date: string; dsc_holder_name?: string | null; gstin?: string | null; status: string
}
interface Props { clients: ClientDSC[]; today: string; canManage: boolean }

type Filter = 'all' | 'expired' | '7' | '30' | '90'

function getDaysRemaining(expiryDate: string, today: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - new Date(today).getTime()) / 86400000)
}

function getStatusInfo(days: number): { label: string; bg: string; color: string } {
  if (days < 0)   return { label: 'Expired',  bg: 'rgba(239,68,68,0.15)',   color: '#f87171' }
  if (days <= 7)  return { label: 'Critical',  bg: 'rgba(249,115,22,0.15)', color: '#fb923c' }
  if (days <= 30) return { label: 'Warning',   bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
  if (days <= 90) return { label: 'OK',        bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' }
  return           { label: 'Fine',            bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function DSCExpiryView({ clients, today, canManage }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const withDays = clients.map(c => ({
    ...c,
    days: getDaysRemaining(c.dsc_expiry_date, today),
  }))

  const expiredCount  = withDays.filter(c => c.days < 0).length
  const criticalCount = withDays.filter(c => c.days >= 0 && c.days <= 7).length
  const warningCount  = withDays.filter(c => c.days >= 8 && c.days <= 30).length
  const fineCount     = withDays.filter(c => c.days > 30).length

  const filtered = withDays.filter(c => {
    if (filter === 'all')     return true
    if (filter === 'expired') return c.days < 0
    if (filter === '7')       return c.days >= 0 && c.days <= 7
    if (filter === '30')      return c.days >= 0 && c.days <= 30
    if (filter === '90')      return c.days >= 0 && c.days <= 90
    return true
  })

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'expired', label: 'Expired' },
    { key: '7',       label: 'Next 7 days' },
    { key: '30',      label: 'Next 30 days' },
    { key: '90',      label: 'Next 90 days' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg, #0f172a)', margin: 0, lineHeight: 1.2 }}>
          DSC Expiry Tracker
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-muted, rgba(15,23,42,0.5))', margin: '4px 0 0' }}>
          Digital Signature Certificates expiring soon
        </p>
      </div>

      {/* Summary strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24,
      }}>
        {[
          { label: 'Expired',        count: expiredCount,  bg: 'rgba(239,68,68,0.1)',   color: '#ef4444',  border: 'rgba(239,68,68,0.25)' },
          { label: 'Critical (≤7d)', count: criticalCount, bg: 'rgba(249,115,22,0.1)',  color: '#f97316',  border: 'rgba(249,115,22,0.25)' },
          { label: 'Warning (≤30d)', count: warningCount,  bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b',  border: 'rgba(245,158,11,0.25)' },
          { label: 'OK (>30d)',      count: fineCount,     bg: 'rgba(20,184,166,0.1)',  color: '#0d9488',  border: 'rgba(20,184,166,0.25)' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 10, padding: '14px 18px',
          }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.count}</p>
            <p style={{ fontSize: 11, color: s.color, opacity: 0.75, margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {filters.map(f => {
          const active = filter === f.key
          return (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                background: active ? '#0d9488' : 'rgba(15,23,42,0.07)',
                color: active ? '#fff' : 'var(--fg-muted, rgba(15,23,42,0.55))',
              }}>
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          color: 'var(--fg-muted, rgba(15,23,42,0.4))', fontSize: 14,
          background: 'rgba(15,23,42,0.03)', borderRadius: 12,
          border: '1px dashed rgba(15,23,42,0.12)',
        }}>
          <p style={{ margin: 0, fontWeight: 500 }}>No clients match this filter</p>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>Try selecting a different time range</p>
        </div>
      ) : (
        <div style={{
          border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12, overflow: 'hidden',
          background: '#fff',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.4fr 1.2fr 1.2fr 1.5fr 100px',
            gap: 0,
            background: 'rgba(15,23,42,0.04)',
            borderBottom: '1px solid rgba(15,23,42,0.1)',
            padding: '0',
          }}>
            {['Client', 'DSC Holder', 'GSTIN', 'Contact', 'Expiry Date', 'Status'].map((col, i) => (
              <div key={col} style={{
                padding: '10px 16px', fontSize: 11, fontWeight: 700,
                color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em',
                borderRight: i < 5 ? '1px solid rgba(15,23,42,0.07)' : 'none',
              }}>
                {col}
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((client, idx) => {
            const statusInfo = getStatusInfo(client.days)
            const daysLabel = client.days < 0
              ? `${Math.abs(client.days)}d overdue`
              : client.days === 0
                ? 'Expires today'
                : `${client.days}d left`

            return (
              <div key={client.id} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.4fr 1.2fr 1.2fr 1.5fr 100px',
                borderBottom: idx < filtered.length - 1 ? '1px solid rgba(15,23,42,0.07)' : 'none',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Client name */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                  borderRight: '1px solid rgba(15,23,42,0.07)' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: client.color || '#0d9488',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 12,
                  }}>
                    {client.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg, #0f172a)',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 180 }}>
                      {client.name}
                    </p>
                    {client.status && client.status !== 'active' && (
                      <span style={{ fontSize: 10, color: 'rgba(15,23,42,0.35)', textTransform: 'capitalize' }}>
                        {client.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* DSC Holder */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center',
                  borderRight: '1px solid rgba(15,23,42,0.07)' }}>
                  <span style={{ fontSize: 13, color: client.dsc_holder_name ? 'var(--fg, #0f172a)' : 'rgba(15,23,42,0.3)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {client.dsc_holder_name || '—'}
                  </span>
                </div>

                {/* GSTIN */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center',
                  borderRight: '1px solid rgba(15,23,42,0.07)' }}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace',
                    color: client.gstin ? 'var(--fg, #0f172a)' : 'rgba(15,23,42,0.3)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {client.gstin || '—'}
                  </span>
                </div>

                {/* Contact */}
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  borderRight: '1px solid rgba(15,23,42,0.07)', gap: 2 }}>
                  {client.email && (
                    <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.55)',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.45)' }}>
                      {client.phone}
                    </span>
                  )}
                  {!client.email && !client.phone && (
                    <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.3)' }}>—</span>
                  )}
                </div>

                {/* Expiry date */}
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  borderRight: '1px solid rgba(15,23,42,0.07)', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg, #0f172a)' }}>
                    {formatDate(client.dsc_expiry_date)}
                  </span>
                  <span style={{ fontSize: 11, color: statusInfo.color, fontWeight: 500 }}>
                    {daysLabel}
                  </span>
                </div>

                {/* Status badge */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: statusInfo.bg, color: statusInfo.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {statusInfo.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
