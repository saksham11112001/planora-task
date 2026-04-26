export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }     from 'next/navigation'
import { CustomFieldsSettingsForm } from './CustomFieldsSettingsForm'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Custom task fields' }

export default async function CustomFieldsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')

  const supabase = await createClient()
  const { data: settings } = await supabase.from('org_settings').select('custom_task_fields').eq('org_id', mb.org_id).maybeSingle()
  const initial = (settings?.custom_task_fields as any[]) ?? []
  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Custom task fields</h1>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>
        Add custom fields that appear on all tasks — like Case Number, Filing Date, Hearing Date, Officer Details etc.
        These appear in the task detail panel for all task types.
      </p>
      <CustomFieldsSettingsForm orgId={mb.org_id} initial={initial}/>
    </div>
  )
}
