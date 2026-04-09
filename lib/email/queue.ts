import { createAdminClient } from '@/lib/supabase/admin'

export type NotifMode = 'immediate' | 'digest'

// ── Read org notification mode from org_feature_settings ─────────────────
export async function getOrgNotifMode(orgId: string): Promise<NotifMode> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', orgId)
    .eq('feature_key', 'notification_frequency')
    .maybeSingle()
  return (data?.config as any)?.mode ?? 'immediate'
}

// ── Helper: look up org_id for a user then return the org's mode ──────────
export async function getOrgNotifModeForUser(
  userId: string
): Promise<{ mode: NotifMode; orgId: string | null }> {
  const admin = createAdminClient()
  const { data: mb } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!mb?.org_id) return { mode: 'immediate', orgId: null }
  const mode = await getOrgNotifMode(mb.org_id)
  return { mode, orgId: mb.org_id }
}

// ── Queue a notification for digest delivery ──────────────────────────────
export async function queueNotification(p: {
  orgId:     string
  userId:    string
  userEmail: string
  eventType: string
  subject:   string
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('notification_queue').insert({
    org_id:     p.orgId,
    user_id:    p.userId,
    user_email: p.userEmail,
    event_type: p.eventType,
    subject:    p.subject,
  })
  if (error) console.error('[notification_queue insert]', error.message)
}

// ── Fetch all pending queue items for an org ──────────────────────────────
export async function getPendingForOrg(orgId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('notification_queue')
    .select('id, user_id, user_email, event_type, subject, created_at')
    .eq('org_id', orgId)
    .is('sent_at', null)
    .order('created_at', { ascending: true })
  return data ?? []
}

// ── Mark a batch of queue items as sent ───────────────────────────────────
export async function markQueueSent(ids: string[]) {
  if (!ids.length) return
  const admin = createAdminClient()
  await admin
    .from('notification_queue')
    .update({ sent_at: new Date().toISOString() })
    .in('id', ids)
}
