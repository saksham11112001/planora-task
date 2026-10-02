import { redirect }               from 'next/navigation'
import { getSessionUser }         from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { createAdminClient }      from '@/lib/supabase/admin'
import { canDo }                  from '@/lib/utils/permissionGate'
import { getCountry }             from '@/lib/locale/countries'
import LeadsView                  from './LeadsView'
import type { Metadata }          from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leads' }

export default async function LeadsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const admin = createAdminClient()

  // Opt-in per org. The sidebar hides the link when it is off, but the URL
  // is reachable by hand, so the page re-checks rather than trusting nav.
  // Read org_feature_settings — that is the store the Settings toggle writes
  // and /api/settings/bootstrap reads. org_settings.nav_features is a legacy
  // column nothing in the app writes any more.
  const { data: flag } = await admin.from('org_feature_settings')
    .select('is_enabled')
    .eq('org_id', mb.org_id).eq('feature_key', 'crm')
    .maybeSingle()
  if (flag?.is_enabled !== true) redirect('/dashboard')

  const { data: settings } = await admin.from('org_settings')
    .select('locale').eq('org_id', mb.org_id).maybeSingle()
  const country = getCountry((settings?.locale as { country?: string } | null)?.country)

  const [canViewAll, canCreate, canEdit, canConvert, canManageProposals] = await Promise.all([
    canDo(admin, mb.org_id, user.id, mb.role, 'leads.view_all'),
    canDo(admin, mb.org_id, user.id, mb.role, 'leads.create'),
    canDo(admin, mb.org_id, user.id, mb.role, 'leads.edit'),
    canDo(admin, mb.org_id, user.id, mb.role, 'leads.convert'),
    canDo(admin, mb.org_id, user.id, mb.role, 'proposals.manage'),
  ])

  // Only fetch the roster for someone allowed to see other people's leads,
  // so a plain member's props payload cannot leak the team list.
  let members: { id: string; name: string }[] = []
  if (canViewAll) {
    const { data } = await admin.from('org_members')
      .select('user_id, is_active, users(id, name, email)').eq('org_id', mb.org_id)
    members = (data ?? [])
      .filter(m => (m as { is_active?: boolean | null }).is_active !== false)
      .map(m => {
        const u = (m as unknown as { users: { id: string; name: string | null; email: string | null } | null }).users
        return { id: u?.id ?? (m as { user_id: string }).user_id, name: u?.name || u?.email || 'Unknown' }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <LeadsView
      currentUserId={user.id}
      currencySymbol={country.currencySymbol}
      locale={country.locale}
      members={members}
      perms={{ viewAll: canViewAll, create: canCreate, edit: canEdit, convert: canConvert, manageProposals: canManageProposals }}
    />
  )
}
