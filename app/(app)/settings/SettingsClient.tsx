'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, Palette, Users, CreditCard, Bell,
         LayoutGrid, Tag, Trash2, ShieldCheck, Search, Zap, Clock } from 'lucide-react'
import { DeleteAccountButton } from './DeleteAccountButton'

interface Section {
  href: string; label: string; desc: string
  adminOnly: boolean; color: string; bg: string; iconName: string
}

const ICON_MAP: Record<string, any> = {
  Palette, Building2, Users, LayoutGrid, Tag, CreditCard, Bell, Trash2, ShieldCheck, Zap, Clock
}

interface Props {
  sections: Section[]
  isAdmin: boolean
  orgName: string
  planTier: string
  role: string
  userId: string
  orgId: string
  isOwner: boolean
}

export function SettingsClient({ sections, isAdmin, orgName, planTier, role, userId, orgId, isOwner }: Props) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? sections.filter(s =>
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.desc.toLowerCase().includes(query.toLowerCase())
      )
    : sections

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {orgName} · <span style={{ color: 'var(--brand)', fontWeight: 500 }}>{planTier}</span> plan · Role: <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{role}</span>
        </p>
      </div>

      {/* Quick search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}/>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search settings…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid var(--border)',
            borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          onFocus={e => (e.target.style.borderColor = 'var(--brand)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        {query && (
          <button onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
        )}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          No settings found for "{query}"
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(s => {
          const locked = s.adminOnly && !isAdmin
          const Icon = ICON_MAP[s.iconName]
          return (
            <Link key={s.href} href={locked ? '#' : s.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, textDecoration: 'none',
                opacity: locked ? 0.4 : 1,
                pointerEvents: locked ? 'none' : 'auto',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!locked) {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = s.color
                  // Use a translucent version of the brand color so it works in dark mode
                  el.style.background = 'var(--surface-hover, var(--surface-subtle))'
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.background = 'var(--surface)'
              }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: `${s.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icon && <Icon style={{ width: 18, height: 18, color: s.color }}/>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.desc}</p>
              </div>
              {locked
                ? <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border-light)', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>Admin only</span>
                : <ArrowRight style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }}/>
              }
            </Link>
          )
        })}
      </div>

      {/* Danger zone — owner/admin only */}
      {(role === 'owner' || role === 'admin') && (
      <div style={{ marginTop: 32, padding: '20px', borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#b91c1c', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 style={{ width: 15, height: 15 }}/> Delete account
            </p>
            <p style={{ fontSize: 12, color: '#b91c1c', opacity: 0.8, maxWidth: 380 }}>
              {isOwner
                ? 'Permanently deletes your account AND the entire organisation including all tasks, projects, clients, and team data.'
                : 'Removes you from the organisation and deletes your personal account.'
              } This cannot be undone.
            </p>
          </div>
          <DeleteAccountButton userId={userId} orgId={orgId} isOwner={isOwner}/>
        </div>
      </div>
      )}
    </div>
  )
}