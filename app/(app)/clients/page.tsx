import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import type { Metadata } from 'next'
import { ClientsView }   from './ClientsView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const { data: clients } = await supabase
    .from('clients').select('id, name, color, status, email, company, industry')
    .eq('org_id', mb.org_id).order('name')

  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  return (
    <ClientsView
      initialClients={clients ?? []}
      canManage={canManage}
    />
  )
}
