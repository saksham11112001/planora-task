export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }     from 'next/navigation'
import { OrgForm }      from './OrgForm'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Organisation settings' }

export const revalidate = 20

export default async function OrgSettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')

  const supabase = createAdminClient()
  const { data: org } = await supabase.from('organisations').select('*').eq('id', mb.org_id).single()
  if (!org) redirect('/settings')
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Organisation settings</h1>
      <OrgForm org={org as any}/>
    </div>
  )
}
