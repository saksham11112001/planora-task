import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { MembersView }  from './MembersView'

export async function MembersFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getOrgMembership(user.id)
  if (!mb) return null

  const supabase = await createClient()

  const [{ data: members }, { data: org }] = await Promise.all([
    supabase.from('org_members')
      .select('id, role, joined_at, user_id, can_view_all_tasks, can_view_monitor, users(id, name, email, avatar_url)')
      .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at'),
    supabase.from('organisations')
      .select('join_code, referral_code, trial_extension_days')
      .eq('id', mb.org_id)
      .single(),
  ])

  const isAdmin = ['owner','admin'].includes(mb.role)
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Team members</h1>
      <MembersView
        members={(members ?? []).map(m => ({ ...m, users: m.users as any }))}
        currentUserId={user.id}
        isAdmin={isAdmin}
        joinCode={org?.join_code ?? null}
        referralCode={org?.referral_code ?? null}
        referralExtensionDays={org?.trial_extension_days ?? 0}
      />
    </div>
  )
}
