import { redirect } from 'next/navigation'
import { AppShell } from './AppShell'
import { getSessionUser, getOrgMembership, getUserProfile } from '@/lib/supabase/cached'

// Prevent caching issues in App Router
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const user = await getSessionUser()
    if (!user) redirect('/login')

    // Run in parallel
    const [membership, profile] = await Promise.all([
      getOrgMembership(user.id),
      getUserProfile(user.id),
    ])

    // Handle missing membership safely
    if (!membership) {
      try {
        const { createClient: createAdminClient } = await import('@/lib/supabase/admin')
        const admin = createAdminClient()

        const { data: pending, error } = await admin
          .from('org_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('Pending membership fetch error:', error)
          redirect('/onboarding')
        }

        if (pending?.id) {
          const { error: updateError } = await admin
            .from('org_members')
            .update({ is_active: true })
            .eq('id', pending.id)

          if (updateError) {
            console.error('Membership activation error:', updateError)
            redirect('/onboarding')
          }

          // Force reload so fresh membership is picked up
          redirect('/dashboard?refresh=1')
        }

        redirect('/onboarding')
      } catch (err) {
        console.error('Membership handling failed:', err)
        redirect('/onboarding')
      }
    }

    const org = membership.organisations as unknown as {
      id: string
      name: string
      slug: string
      plan_tier: string
      logo_color: string
      status: string | null
      trial_ends_at: string | null
    } | null

    if (!org) redirect('/onboarding')

    return (
      <AppShell
        user={{
          id: user.id,
          name: profile?.name ?? user.email?.split('@')[0] ?? 'User',
          email: user.email ?? '',
          avatar_url: profile?.avatar_url ?? null,
        }}
        org={{
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan_tier: org.plan_tier as any,
          logo_color: org.logo_color ?? '#0d9488',
          status: (org as any).status ?? null,
          trial_ends_at: (org as any).trial_ends_at ?? null,
        }}
        role={membership.role}
        workspaceId={null}
      >
        {children}
      </AppShell>
    )
  } catch (err) {
    console.error('AppLayout crashed:', err)
    redirect('/login') // fallback instead of blank error screen
  }
}