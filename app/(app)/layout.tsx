import { redirect }  from 'next/navigation'
import { AppShell }  from './AppShell'
import { getSessionUser, getUserProfile } from '@/lib/supabase/cached'
import { getActiveOrgMembership, getUserOrgs } from '@/lib/supabase/activeOrg'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    // Use React-cached helpers so the layout and child page components share
    // a single set of DB calls per request — no double-fetching.
    const user = await getSessionUser()
    if (!user) redirect('/login')

    // Membership + profile + all orgs can run in parallel
    const [membership, profile, allOrgs] = await Promise.all([
      getActiveOrgMembership(user.id),
      getUserProfile(user.id),
      getUserOrgs(user.id),
    ])

    // Repair: reactivate memberships incorrectly deactivated by a past provision/join-invite bug
    // that set is_active=false on all other orgs when a user accepted an invite.
    // Only runs when user has fewer than 2 active orgs (self-healing: skipped once fixed).
    if (allOrgs.length < 2) {
      const { createAdminClient: _adminForRepair } = await import('@/lib/supabase/admin')
      const adminRepair = _adminForRepair()
      const { data: inactiveRows } = await adminRepair
        .from('org_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', false)

      if (inactiveRows && inactiveRows.length > 0) {
        await adminRepair.from('org_members')
          .update({ is_active: true })
          .in('id', inactiveRows.map((m: any) => m.id))
        redirect('/dashboard')
      }
    }

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

        // Clear the pending invite metadata — do NOT deactivate other org memberships
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...authUserData?.user?.user_metadata, invited_to_org: null, invited_role: null },
        })

        redirect('/dashboard')
      }

      // 2. Check if this user is a standalone partner — send to partner portal.
      //    Check by user_id first; fall back to email for users who signed up as partners
      //    but haven't yet visited /partners/dashboard to get their user_id linked.
      let { data: standalonePartner } = await admin
        .from('standalone_partners')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!standalonePartner && user.email) {
        const { data: byEmail } = await admin
          .from('standalone_partners')
          .select('id')
          .eq('email', user.email.toLowerCase())
          .is('user_id', null)
          .maybeSingle()
        if (byEmail) {
          // Link user_id now so future checks work via user_id
          await admin.from('standalone_partners').update({ user_id: user.id }).eq('id', byEmail.id)
          standalonePartner = byEmail
        }
      }

      if (standalonePartner) redirect('/partners/dashboard')

      // 3. Truly no org membership anywhere — send to onboarding to create one
      //    (do NOT redirect to /login here — the user IS authenticated)
      redirect('/onboarding')
    }

    const org = membership.organisations as any
    if (!org) redirect('/onboarding')

    return (
      <AppShell
        user={{
          id:                 user.id,
          name:               profile?.name ?? user.email?.split('@')[0] ?? 'User',
          email:              user.email ?? '',
          avatar_url:         profile?.avatar_url ?? null,
          created_at:         user.created_at,
          tour_completed_at:  (profile as any)?.tour_completed_at ?? null,
        }}
        org={{
          id:                   org.id ?? '',
          name:                 org.name ?? '',
          slug:                 org.slug ?? '',
          plan_tier:            org.plan_tier ?? 'free',
          logo_color:           org.logo_color ?? '#0d9488',
          status:               org.status ?? null,
          trial_ends_at:        org.trial_ends_at ?? null,
          trial_started_at:     org.trial_started_at ?? null,
          trial_extension_days: org.trial_extension_days ?? 0,
          referral_code:        org.referral_code ?? null,
          join_code:            org.join_code ?? null,
        }}
        role={membership.role ?? 'member'}
        workspaceId={null}
        allOrgs={(() => {
          const seen = new Set<string>()
          return allOrgs.flatMap((m: any) => {
            const id = (m.organisations as any)?.id ?? m.org_id
            if (!id || seen.has(id)) return []
            seen.add(id)
            return [{ id, name: (m.organisations as any)?.name ?? '', logo_color: (m.organisations as any)?.logo_color ?? '#0d9488', role: m.role ?? 'member' }]
          })
        })()}
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
