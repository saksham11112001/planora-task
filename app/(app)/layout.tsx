import { redirect }  from 'next/navigation'
import { AppShell }  from './AppShell'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient()

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) redirect('/login')

    // Get membership with org details in one query
    const { data: membership, error: memberError } = await supabase
      .from('org_members')
      .select('id, org_id, role, is_active, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at)')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .maybeSingle()

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
      .eq('id', user!.id)
      .maybeSingle()

    // No active membership — check for pending/inactive membership
    if (!membership) {
      const { createClient: createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()

      const { data: pending } = await admin
        .from('org_members')
        .select('id, org_id, role, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pending) {
        // Activate membership and go to dashboard
        await admin.from('org_members').update({ is_active: true }).eq('id', pending.id)
        redirect('/dashboard')
      }

      // Truly no org — go to onboarding
      redirect('/onboarding')
    }

    const org = membership.organisations as any
    if (!org) redirect('/onboarding')

    return (
      <AppShell
        user={{
          id:         user!.id,
          name:       profile?.name ?? user!.email?.split('@')[0] ?? 'User',
          email:      user!.email ?? '',
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
  } catch (err: any) {
    // If it's a redirect, re-throw it (Next.js redirects are thrown internally)
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
    // Any other error — send to login safely
    console.error('[AppLayout] crash:', err?.message ?? err)
    redirect('/login')
  }
}
