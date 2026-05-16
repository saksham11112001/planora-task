export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }     from 'next/navigation'
import { PermissionsView } from './PermissionsView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Role permissions' }

export default async function PermissionsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getActiveOrgMembership(user.id)
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')

  const supabase = createAdminClient()

  const org = mb.organisations as any
  const trialActive = org?.status === 'trialing' && org?.trial_ends_at && new Date(org.trial_ends_at) > new Date()
  const isPaid = trialActive || ['starter','pro','business'].includes(org?.plan_tier ?? '')

  // Load saved permissions
  const { data: settings } = await supabase
    .from('org_settings')
    .select('role_permissions')
    .eq('org_id', mb.org_id)
    .maybeSingle()

  const saved = (settings?.role_permissions as any) ?? null

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <PermissionsView
        orgId={mb.org_id}
        savedPermissions={saved}
        isPaid={isPaid}
        planTier={org?.plan_tier ?? 'free'}
      />
    </div>
  )
}
