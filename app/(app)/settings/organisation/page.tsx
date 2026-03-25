import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { OrgForm }      from './OrgForm'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Organisation settings' }

export const revalidate = 20

export default async function OrgSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')
  const { data: org } = await supabase.from('organisations').select('*').eq('id', mb.org_id).single()
  if (!org) redirect('/settings')
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Organisation settings</h1>
      <OrgForm org={org as any}/>
    </div>
  )
}
