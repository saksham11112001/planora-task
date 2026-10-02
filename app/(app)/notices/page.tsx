import { redirect }               from 'next/navigation'
import { getSessionUser }         from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { createAdminClient }      from '@/lib/supabase/admin'
import { todayInCountry }         from '@/lib/locale/countries'
import NoticesView                from './NoticesView'
import type { Metadata }          from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Notices' }

export default async function NoticesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const admin = createAdminClient()

  // "Today" in the firm's own timezone. A notice due today is not overdue,
  // and which day that is depends on where the firm is — reading the server
  // clock would mark Indian notices overdue from 6:30pm the day before.
  const { data: settings } = await admin.from('org_settings')
    .select('locale').eq('org_id', mb.org_id).maybeSingle()
  const country = (settings?.locale as { country?: string } | null)?.country
  const today   = todayInCountry(country)

  const { data: members } = await admin.from('org_members')
    .select('user_id, is_active, users(id, name, email)')
    .eq('org_id', mb.org_id)

  const memberList = (members ?? [])
    // is_active is null on older rows; only a hard false means inactive.
    .filter(m => (m as { is_active?: boolean | null }).is_active !== false)
    .map(m => {
      const u = (m as unknown as { users: { id: string; name: string | null; email: string | null } | null }).users
      return { id: u?.id ?? (m as { user_id: string }).user_id, name: u?.name || u?.email || 'Unknown' }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <NoticesView
      today={today}
      members={memberList}
      canEdit={['owner', 'admin', 'manager'].includes(mb.role)}
    />
  )
}
