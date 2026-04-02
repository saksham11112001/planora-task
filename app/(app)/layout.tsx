import { redirect }  from 'next/navigation'
import { AppShell }  from './AppShell'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  // Get membership with org details
  const { data: membership } = await supabase
    .from('org_members')
    .select('id, org_id, role, is_active, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (!membership) {
    // Try to activate a pending membership
    const { createClient: adminCreate } = await import('@/lib/supabase/admin')
    const admin = adminCreate()
    const { data: pending } = await admin
      .from('org_members')
      .select('id, org_id, role, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pending) {
      await admin.from('org_members').update({ is_active: true }).eq('id', pending.id)
      redirect('/dashboard')
    }
    redirect('/onboarding')
  }

  const org = membership.organisations as any
  if (!org) redirect('/onboarding')

  return (
    <AppShell
      user={{
        id:         user.id,
        name:       profile?.name ?? user.email?.split('@')[0] ?? 'User',
        email:      user.email ?? '',
        avatar_url: profile?.avatar_url ?? null,
      }}
      org={{
        id:            org.id ?? '',
        name:          org.name ?? '',
        slug:          org.slug ?? '',
        plan_tier:     org.plan_tier ?? 'free',
        logo_color:    org.logo_color ?? '#0d9488',
        status:        org.status ?? null,
        trial_ends_at: org.trial_ends_at ?? null,
      }}
      role={membership.role ?? 'member'}
      workspaceId={null}
    >
      {children}
    </AppShell>
  )
}
