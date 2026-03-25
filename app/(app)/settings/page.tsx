import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'
import { Building2, Palette, Users, CreditCard, Bell, ArrowRight,
         LayoutGrid, Tag, Trash2 } from 'lucide-react'
import { DeleteAccountButton } from './DeleteAccountButton'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Settings' }
export const revalidate = 20

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members')
    .select('role, org_id, organisations(name, plan_tier)')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const isAdmin = ['owner', 'admin'].includes(mb.role)
  const org = mb.organisations as unknown as { name: string; plan_tier: string } | null

  const SECTIONS = [
    { href: '/settings/appearance',  icon: Palette,    label: 'Appearance',         desc: 'Theme and display preferences',           adminOnly: false, color: '#7c3aed', bg: '#f5f3ff' },
    { href: '/settings/organisation',icon: Building2,  label: 'Organisation',        desc: 'Name, industry, brand colour',            adminOnly: true,  color: '#0d9488', bg: '#f0fdfa' },
    { href: '/settings/members',     icon: Users,      label: 'Team members',        desc: 'Invite people, manage roles',             adminOnly: false, color: '#0891b2', bg: '#ecfeff' },
    { href: '/settings/tasks',       icon: LayoutGrid, label: 'Task fields',         desc: 'Show/hide fields, set mandatory fields',  adminOnly: true,  color: '#ca8a04', bg: '#fffbeb' },
    { href: '/settings/categories',  icon: Tag,        label: 'Client categories',   desc: 'Manage client category options',          adminOnly: true,  color: '#ea580c', bg: '#fff7ed' },
    { href: '/settings/billing',     icon: CreditCard, label: 'Billing & plan',      desc: 'Subscription, upgrade options',           adminOnly: true,  color: '#16a34a', bg: '#f0fdf4' },
    { href: '/settings/notifications',icon: Bell,      label: 'Notifications',       desc: 'Email and WhatsApp preferences',          adminOnly: false, color: '#db2777', bg: '#fdf2f8' },
  ]

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {org?.name} · <span style={{ color: 'var(--brand)', fontWeight: 500 }}>{org?.plan_tier ?? 'free'}</span> plan · Role: <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{mb.role}</span>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECTIONS.map(s => {
          const locked = s.adminOnly && !isAdmin
          const Icon = s.icon
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
              onMouseEnter={e => { if (!locked) { (e.currentTarget as any).style.borderColor = s.color; (e.currentTarget as any).style.background = s.bg } }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor = 'var(--border)'; (e.currentTarget as any).style.background = 'var(--surface)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 18, height: 18, color: s.color }}/>
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

      {/* Danger zone */}
      <div style={{ marginTop: 32, padding: '20px 20px', borderRadius: 12,
        border: '1px solid #fecaca', background: '#fef2f2' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#b91c1c', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 style={{ width: 15, height: 15 }}/> Delete account
            </p>
            <p style={{ fontSize: 12, color: '#b91c1c', opacity: 0.8 }}>
              Permanently delete your account and all associated tasks, projects, and data. This cannot be undone.
            </p>
          </div>
          <DeleteAccountButton userId={user.id} orgId={mb.org_id} isOwner={mb.role === 'owner'}/>
        </div>
      </div>
    </div>
  )
}
