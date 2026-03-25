import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'
import { Building2, Palette, Users, CreditCard, Bell, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Settings' }

const SETTINGS_SECTIONS = [
  {
    href:      '/settings/appearance',
    icon:      Palette,
    label:     'Appearance',
    desc:      'Theme, dark mode, display',
    color:     'bg-violet-50 text-violet-600',
    adminOnly: false,
  },
  {
    href:      '/settings/organisation',
    icon:      Building2,
    label:     'Organisation',
    desc:      'Name, industry, brand colour',
    color:     'bg-teal-50 text-teal-600',
    adminOnly: true,
  },
  {
    href:      '/settings/members',
    icon:      Users,
    label:     'Team members',
    desc:      'Invite people, manage roles',
    color:     'bg-violet-50 text-violet-600',
    adminOnly: false,
  },
  {
    href:      '/settings/billing',
    icon:      CreditCard,
    label:     'Billing & Plan',
    desc:      'Subscription, upgrade to Pro or Business',
    color:     'bg-amber-50 text-amber-600',
    adminOnly: true,
  },
  {
    href:      '/settings/notifications',
    icon:      Bell,
    label:     'Notifications',
    desc:      'Email and WhatsApp alert preferences',
    color:     'bg-pink-50 text-pink-600',
    adminOnly: false,
  },
]

export const revalidate = 20

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members')
    .select('role, organisations(name, plan_tier)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!mb) redirect('/onboarding')

  const isAdmin = ['owner', 'admin'].includes(mb.role)
  const org     = mb.organisations as unknown as { name: string; plan_tier: string } | null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          {org?.name} ·{' '}
          <span className="capitalize font-medium text-teal-600">{org?.plan_tier ?? 'free'}</span> plan ·{' '}
          Role: <span className="capitalize font-medium">{mb.role}</span>
        </p>
      </div>

      <div className="space-y-3">
        {SETTINGS_SECTIONS.map(section => {
          const locked = section.adminOnly && !isAdmin
          const Icon   = section.icon
          return (
            <Link
              key={section.href}
              href={locked ? '#' : section.href}
              aria-disabled={locked}
              className={cn(
                'flex items-center gap-4 p-4 card hover:shadow-md transition-all',
                locked && 'opacity-40 cursor-not-allowed pointer-events-none'
              )}
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${section.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{section.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{section.desc}</p>
              </div>
              {locked
                ? <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">Admin only</span>
                : <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              }
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// tiny local helper so we don't import a lib
function cn(...cs: (string | boolean | undefined)[]) {
  return cs.filter(Boolean).join(' ')
}
