import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { TaskSettingsForm } from './TaskSettingsForm'
import type { Metadata }   from 'next'
export const metadata: Metadata = { title: 'Task settings' }
export const revalidate = 20

export default async function TaskSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')
  // Load existing settings
  const { data: settings } = await supabase.from('org_settings').select('task_fields').eq('org_id', mb.org_id).maybeSingle()
  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Task field settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Choose which fields are visible and which are mandatory when creating or editing tasks.
      </p>
      <TaskSettingsForm orgId={mb.org_id} initial={(settings?.task_fields as any) ?? null}/>
    </div>
  )
}
