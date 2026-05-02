import { createClient }  from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { ClientsView }   from './ClientsView'

export async function ClientsFetcher() {
  const user = await getSessionUser()
  if (!user) return null
  const mb = await getOrgMembership(user.id)
  if (!mb) return null

  const supabase = await createClient()

  const [{ data: clients }, { data: groups }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, color, status, email, company, industry, group_id')
      .eq('org_id', mb.org_id)
      .order('name'),
    supabase
      .from('client_groups')
      .select('id, name, color, notes, created_at, updated_at')
      .eq('org_id', mb.org_id)
      .order('name'),
  ])

  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  return (
    <ClientsView
      initialClients={clients ?? []}
      initialGroups={groups ?? []}
      canManage={canManage}
    />
  )
}
