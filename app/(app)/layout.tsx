import { redirect }  from 'next/navigation'
import { AppShell }  from './AppShell'
import { getSessionUser, getOrgMembership, getUserProfile } from '@/lib/supabase/cached'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    // Use React-cached helpers so the layout and child page components share
    // a single set of DB calls per request — no double-fetching.
    const user = await getSessionUser()
    if (!user) redirect('/login')

    // Membership + profile can run in parallel — both only need user.id
    const [membership, profile] = await Promise.all([
      getOrgMembership(user.id),
      getUserProfile(user.id),
    ])

    // No active membership — try to recover before giving up
    if (!membership) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()

      // 1. Check if the user has a pending invite in their auth metadata
      //    (covers cross-device Google OAuth where callback ran but org_members wasn't written)
      const { data: authUserData } = await admin.auth.admin.getUserById(user.id)
      const pendingOrgId = authUserData?.user?.user_metadata?.invited_to_org as string | undefined
      const pendingRole  = (authUserData?.user?.user_metadata?.invited_role as string | undefined) ?? 'member'

      if (pendingOrgId) {
        const { data: existingMember } = await admin
          .from('org_members')
          .select('id, is_active')
          .eq('org_id', pendingOrgId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!existingMember) {
          await admin.from('org_members').insert({
            org_id: pendingOrgId, user_id: user.id, role: pendingRole, is_active: true,
          })
        } else if (!existingMember.is_active) {
          await admin.from('org_members').update({ is_active: true, role: pendingRole }).eq('id', existingMember.id)
        }

        // Deactivate any active memberships in OTHER orgs to ensure single active org per user.
        await admin.from('org_members')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .neq('org_id', pendingOrgId)
          .eq('is_active', true)

        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...authUserData?.user?.user_metadata, invited_to_org: null, invited_role: null },
        })

        redirect('/dashboard')
      }

      // 2. Check for any existing membership row (active or inactive)
      //    This catches users added directly to org_members by an admin in Supabase dashboard
      const { data: anyMembership } = await admin
        .from('org_members')
        .select('id, org_id, role, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (anyMembership) {
        // Reactivate this membership and deactivate any others to ensure single active org per user.
        await admin.from('org_members').update({ is_active: true }).eq('id', anyMembership.id)
        await admin.from('org_members')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .neq('id', anyMembership.id)
          .eq('is_active', true)
        redirect('/dashboard')
      }

      // 3. Truly no org membership anywhere — send to onboarding to create one
      //    (do NOT redirect to /login here — the user IS authenticated)
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
  } catch (err: any) {
    // IMPORTANT: Next.js throws redirects internally — always re-throw them
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err

    // Log the actual error for debugging
    console.error('[AppLayout] crash:', err?.message ?? err)

    // Do NOT redirect to /login on generic errors — that creates an infinite loop
    // for authenticated users who have no org. /onboarding is a safer fallback.
    redirect('/onboarding')
  }
}