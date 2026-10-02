import { redirect }                  from 'next/navigation'
import { getSessionUser }            from '@/lib/supabase/cached'
import { getActiveOrgMembership }    from '@/lib/supabase/activeOrg'
import { createAdminClient }         from '@/lib/supabase/admin'
import { canDo }                     from '@/lib/utils/permissionGate'
import AttendanceView                from './AttendanceView'
import type { Metadata }             from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Attendance & leave' }

export default async function AttendancePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const admin = createAdminClient()

  // The module is opt-in per org. If it is switched off, the sidebar hides
  // the link — but the URL is still reachable by hand, so check here too
  // rather than relying on the nav being the only way in.
  //
  // Read org_feature_settings, NOT org_settings.nav_features. There are two
  // parallel stores for feature flags in this codebase and only the first is
  // authoritative: /api/settings/bootstrap and /api/settings/features both
  // read and write org_feature_settings, and that is what the toggle in
  // Settings -> Features updates. org_settings.nav_features is a legacy
  // column that nothing in the app writes any more.
  const { data: flag } = await admin.from('org_feature_settings')
    .select('is_enabled')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'attendance')
    .maybeSingle()
  if (flag?.is_enabled !== true) redirect('/dashboard')

  const [canViewAllAttendance, canEditAttendance, canViewAllLeave, canApproveLeave, canManageBalances] =
    await Promise.all([
      canDo(admin, mb.org_id, user.id, mb.role, 'attendance.view_all'),
      canDo(admin, mb.org_id, user.id, mb.role, 'attendance.edit'),
      canDo(admin, mb.org_id, user.id, mb.role, 'leave.view_all'),
      canDo(admin, mb.org_id, user.id, mb.role, 'leave.approve'),
      canDo(admin, mb.org_id, user.id, mb.role, 'leave.manage_balances'),
    ])

  // Member list for the team tabs. Only fetched when the viewer is allowed to
  // see other people at all, so a plain member's page cannot leak the roster
  // through the props payload.
  let members: { id: string; name: string }[] = []
  if (canViewAllAttendance || canViewAllLeave) {
    const { data } = await admin.from('org_members')
      .select('user_id, is_active, users(id, name, email)')
      .eq('org_id', mb.org_id)
    members = (data ?? [])
      // is_active can be null on older rows; only a hard false is inactive.
      .filter(m => (m as { is_active?: boolean | null }).is_active !== false)
      .map(m => {
        const u = (m as unknown as { users: { id: string; name: string | null; email: string | null } | null }).users
        return { id: u?.id ?? (m as { user_id: string }).user_id, name: u?.name || u?.email || 'Unknown' }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <AttendanceView
      currentUserId={user.id}
      isViewer={mb.role === 'viewer'}
      members={members}
      perms={{
        viewAllAttendance: canViewAllAttendance,
        editAttendance:    canEditAttendance,
        viewAllLeave:      canViewAllLeave,
        approveLeave:      canApproveLeave,
        manageBalances:    canManageBalances,
      }}
    />
  )
}
