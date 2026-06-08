'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  color: string
  status: string
  dsc_expiry_date?: string | null
  email?: string | null
  phone?: string | null
}

interface Props {
  clients: Client[]
  overdueTasks: { client_id: string | null }[]
  invoices: { client_id: string | null; status: string; total: number }[]
  today: string
  canManage: boolean
}

type HealthStatus = 'critical' | 'warning' | 'healthy'
type FilterTab = 'all' | HealthStatus

interface ClientHealth {
  client: Client
  overdueCount: number
  dscDaysLeft: number | null
  dscExpiring: boolean
  hasUnpaidInvoice: boolean
  health: HealthStatus
}

function computeHealth(
  client: Client,
  overdueTasks: { client_id: string | null }[],
  invoices: { client_id: string | null; status: string; total: number }[],
  today: string,
): ClientHealth {
  const overdueCount = overdueTasks.filter(t => t.client_id === client.id).length
  const dscDaysLeft = client.dsc_expiry_date
    ? Math.ceil(
        (new Date(client.dsc_expiry_date).getTime() - new Date(today).getTime()) / 86400000,
      )
    : null
  const dscExpiring = dscDaysLeft !== null && dscDaysLeft <= 30
  const hasUnpaidInvoice = invoices.some(i => i.client_id === client.id && i.status === 'sent')

  let health: HealthStatus
  if (overdueCount > 0 || (dscDaysLeft !== null && dscDaysLeft < 0)) {
    health = 'critical'
  } else if (dscExpiring || hasUnpaidInvoice) {
    health = 'warning'
  } else {
    health = 'healthy'
  }

  return { client, overdueCount, dscDaysLeft, dscExpiring, hasUnpaidInvoice, health }
}

const HEALTH_COLORS: Record<HealthStatus, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.3)', dot: '#ef4444' },
  warning:  { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)', dot: '#f59e0b' },
  healthy:  { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', border: 'rgba(34,197,94,0.3)',  dot: '#22c55e' },
}

const HEALTH_LABEL: Record<HealthStatus, string> = {
  critical: 'Critical',
  warning: 'Warning',
  healthy: 'Healthy',
}

export function ClientHealthView({ clients, overdueTasks, invoices, today, canManage }: Props) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const allHealth = useMemo(
    () => clients.map(c => computeHealth(c, overdueTasks, invoices, today)),
    [clients, overdueTasks, invoices, today],
  )

  const criticalCount = allHealth.filter(h => h.health === 'critical').length
  const warningCount  = allHealth.filter(h => h.health === 'warning').length
  const healthyCount  = allHealth.filter(h => h.health === 'healthy').length

  const filtered = useMemo(() => {
    let list = allHealth
    if (filter !== 'all') list = list.filter(h => h.health === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(h => h.client.name.toLowerCase().includes(q))
    }
    return list
  }, [allHealth, filter, search])

  const tabs: { key: FilterTab; label: string; count: number; color: string }[] = [
    { key: 'all',      label: 'All',      count: clients.length, color: 'rgba(255,255,255,0.55)' },
    { key: 'critical', label: 'Critical', count: criticalCount,  color: '#f87171' },
    { key: 'warning',  label: 'Warning',  count: warningCount,   color: '#fbbf24' },
    { key: 'healthy',  label: 'Healthy',  count: healthyCount,   color: '#4ade80' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg, #0f172a)', margin: 0 }}>
          Client Health Dashboard
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-muted, rgba(15,23,42,0.5))', marginTop: 4 }}>
          {clients.length} active clients &nbsp;·&nbsp;
          <span style={{ color: '#ef4444', fontWeight: 600 }}>{criticalCount} critical</span>
          &nbsp;·&nbsp;
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{warningCount} warning</span>
          &nbsp;·&nbsp;
          <span style={{ color: '#22c55e', fontWeight: 600 }}>{healthyCount} healthy</span>
        </p>
      </div>

      {/* Filter pills + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const active = filter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 500,
                border: active ? `1.5px solid ${tab.color}` : '1.5px solid rgba(0,0,0,0.1)',
                background: active ? `${tab.color}20` : 'transparent',
                color: active ? tab.color : 'var(--fg-muted, rgba(15,23,42,0.55))',
                cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}>
              {tab.label}
              <span style={{
                minWidth: 18, height: 18, borderRadius: 99,
                background: active ? tab.color : 'rgba(0,0,0,0.08)',
                color: active ? '#fff' : 'var(--fg-muted, rgba(15,23,42,0.5))',
                fontSize: 11, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px',
              }}>
                {tab.count}
              </span>
            </button>
          )
        })}

        <input
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, fontSize: 13,
            border: '1.5px solid rgba(0,0,0,0.12)',
            background: 'var(--surface, #fff)',
            color: 'var(--fg, #0f172a)',
            outline: 'none', width: 200,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-muted, rgba(15,23,42,0.4))', fontSize: 14 }}>
          No clients match the current filter.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(h => (
            <ClientCard key={h.client.id} data={h} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClientCard({ data }: { data: ClientHealth }) {
  const { client, overdueCount, dscDaysLeft, dscExpiring, hasUnpaidInvoice, health } = data
  const hc = HEALTH_COLORS[health]

  return (
    <div style={{
      background: 'var(--surface, #fff)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 12,
      padding: '16px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'box-shadow 0.15s',
    }}>
      {/* Top row: avatar + name + health badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: client.color || '#6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 16,
        }}>
          {client.name[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/clients/${client.id}`} style={{ textDecoration: 'none' }}>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 600,
              color: 'var(--fg, #0f172a)',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {client.name}
            </p>
          </Link>
          {client.email && (
            <p style={{
              margin: 0, fontSize: 11, color: 'var(--fg-muted, rgba(15,23,42,0.45))',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {client.email}
            </p>
          )}
        </div>

        {/* Health badge */}
        <span style={{
          padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: hc.bg, color: hc.text, border: `1px solid ${hc.border}`,
          flexShrink: 0, letterSpacing: '0.02em',
        }}>
          {HEALTH_LABEL[health]}
        </span>
      </div>

      {/* Risk flags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {overdueCount > 0 && (
          <RiskPill
            icon="⚠️"
            label={`${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''}`}
            bg="rgba(239,68,68,0.1)"
            color="#ef4444"
          />
        )}
        {dscDaysLeft !== null && dscDaysLeft < 0 && (
          <RiskPill icon="🔒" label="DSC expired" bg="rgba(239,68,68,0.1)" color="#ef4444" />
        )}
        {dscDaysLeft !== null && dscDaysLeft >= 0 && dscDaysLeft <= 30 && (
          <RiskPill
            icon="🔒"
            label={`DSC expires in ${dscDaysLeft}d`}
            bg="rgba(245,158,11,0.1)"
            color="#f59e0b"
          />
        )}
        {hasUnpaidInvoice && (
          <RiskPill icon="💰" label="Unpaid invoice" bg="rgba(245,158,11,0.1)" color="#f59e0b" />
        )}
        {overdueCount === 0 && !dscExpiring && (dscDaysLeft === null || dscDaysLeft >= 0) && !hasUnpaidInvoice && (
          <RiskPill icon="✅" label="All clear" bg="rgba(34,197,94,0.1)" color="#22c55e" />
        )}
      </div>

      {/* View link */}
      <Link
        href={`/clients/${client.id}`}
        style={{
          fontSize: 12, color: 'var(--fg-muted, rgba(15,23,42,0.45))',
          textDecoration: 'none', alignSelf: 'flex-end', marginTop: -4,
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#0d9488'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted, rgba(15,23,42,0.45))'}>
        View client →
      </Link>
    </div>
  )
}

function RiskPill({ icon, label, bg, color }: { icon: string; label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 500,
      background: bg, color,
    }}>
      <span>{icon}</span>
      {label}
    </span>
  )
}
