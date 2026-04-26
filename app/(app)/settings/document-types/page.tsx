export const dynamic = 'force-dynamic'
import { createClient }     from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }         from 'next/navigation'
import { DocumentTypesForm } from './DocumentTypesForm'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata }     from 'next'

export const metadata: Metadata = { title: 'Document Types — Settings' }

export default async function DocumentTypesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')
  if (!['owner', 'admin'].includes(mb.role)) redirect('/settings')

  const supabase = await createClient()

  const admin = createAdminClient()
  const { data: docTypes } = await admin
    .from('client_document_types')
    .select('id, name, category, linked_task_types, sort_order, is_active')
    .eq('org_id', mb.org_id)
    .order('sort_order', { ascending: true })

  // Also fetch ca_master_tasks names for the linked_task_types dropdown
  const { data: masterTasks } = await admin
    .from('ca_master_tasks')
    .select('id, name')
    .eq('org_id', mb.org_id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (
    <DocumentTypesForm
      initialTypes={docTypes ?? []}
      masterTaskNames={(masterTasks ?? []).map((t: any) => t.name)}
    />
  )
}
