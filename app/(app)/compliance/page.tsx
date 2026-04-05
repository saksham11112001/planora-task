import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ComplianceShell } from './ComplianceShell'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')
  return <ComplianceShell userRole={mb.role} />
}
