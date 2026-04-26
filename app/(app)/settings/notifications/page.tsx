export const dynamic = 'force-dynamic'
import { createClient }  from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }       from 'next/navigation'
import { NotifView }      from './NotifView'
import type { Metadata }  from 'next'
export const metadata: Metadata = { title: 'Notifications' }

export const revalidate = 20

export default async function NotificationsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  const { data: prefs } = await supabase.from('notification_preferences')
    .select('*').eq('user_id', user.id).eq('org_id', mb.org_id)

  const prefMap: Record<string, { via_email: boolean; via_whatsapp: boolean }> = {}
  prefs?.forEach(p => { prefMap[p.event_type] = { via_email: p.via_email, via_whatsapp: p.via_whatsapp } })

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notifications</h1>
      <NotifView prefMap={prefMap} orgId={mb.org_id}/>
    </div>
  )
}
