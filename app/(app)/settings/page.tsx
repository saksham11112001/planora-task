import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import type { Metadata }  from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Settings' }
export const revalidate = 20

const SECTIONS = [
  { href: '/settings/appearance',   label: 'Appearance',       desc: 'Theme and display preferences',          adminOnly: false, color: '#7c3aed', bg: '#f5f3ff', iconName: 'Palette'   },
  { href: '/settings/organisation', label: 'Organisation',     desc: 'Name, industry, brand colour',           adminOnly: true,  color: '#0d9488', bg: '#f0fdfa', iconName: 'Building2' },
  { href: '/settings/members',      label: 'Team members',     desc: 'Invite people, manage roles',            adminOnly: false, color: '#0891b2', bg: '#ecfeff', iconName: 'Users'     },
  { href: '/settings/tasks',        label: 'Task fields',      desc: 'Show/hide fields, set mandatory fields', adminOnly: true,  color: '#ca8a04', bg: '#fffbeb', iconName: 'LayoutGrid'},
  { href: '/settings/categories',   label: 'Client categories',desc: 'Manage client category options',         adminOnly: true,  color: '#ea580c', bg: '#fff7ed', iconName: 'Tag'       },
  { href: '/settings/custom-fields', label: 'Custom task fields',  desc: 'Add fields like Case No, Filing Date, Hearing Date', adminOnly: true,  color: '#0891b2', bg: '#ecfeff', iconName: 'LayoutGrid' },
  { href: '/settings/permissions',     label: 'Role permissions',   desc: 'Control what each role can access', adminOnly: true,  color: '#7c3aed', bg: '#f5f3ff', iconName: 'ShieldCheck' },
  { href: '/settings/trash',              label: 'Trash & recovery',    desc: 'Restore deleted tasks (30-day window)',            adminOnly: false, color: '#94a3b8', bg: '#f8fafc', iconName: 'Trash2'    },
  { href: '/settings/billing',          label: 'Billing & plan',   desc: 'Subscription and upgrade options',       adminOnly: true,  color: '#16a34a', bg: '#f0fdf4', iconName: 'CreditCard'},
  { href: '/settings/notifications', label: 'Notifications',   desc: 'Email and WhatsApp preferences',        adminOnly: false, color: '#db2777', bg: '#fdf2f8', iconName: 'Bell'      },
]

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

  return (
    <SettingsClient
      sections={SECTIONS}
      isAdmin={isAdmin}
      orgName={org?.name ?? ''}
      planTier={org?.plan_tier ?? 'free'}
      role={mb.role}
      userId={user.id}
      orgId={mb.org_id}
      isOwner={mb.role === 'owner'}
    />
  )
}
