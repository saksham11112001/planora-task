import { inngest }              from '../client'
import { createAdminClient }    from '@/lib/supabase/admin'
import { getOrgNotifMode, getPendingForOrg, markQueueSent } from '@/lib/email/queue'
import { digestEmailHtml }      from '@/lib/email/templates/digestEmail'
import { resend, FROM }         from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taska.in'

async function runDigest(slot: 'morning' | 'evening') {
  const admin = createAdminClient()

  // Find all orgs on digest mode
  const { data: digestOrgs } = await admin
    .from('org_feature_settings')
    .select('org_id, config')
    .eq('feature_key', 'notification_frequency')

  const digestOrgIds = (digestOrgs ?? [])
    .filter(r => (r.config as any)?.mode === 'digest')
    .map(r => r.org_id)

  if (!digestOrgIds.length) return { sent: 0, orgs: 0 }

  // Fetch org names for the email
  const { data: orgs } = await admin
    .from('organisations')
    .select('id, name')
    .in('id', digestOrgIds)
  const orgNameMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]))

  let totalSent = 0

  for (const orgId of digestOrgIds) {
    const pending = await getPendingForOrg(orgId)
    if (!pending.length) continue

    // Group by user
    const byUser: Record<string, typeof pending> = {}
    for (const item of pending) {
      if (!byUser[item.user_id]) byUser[item.user_id] = []
      byUser[item.user_id].push(item)
    }

    const sentIds: string[] = []

    for (const [, items] of Object.entries(byUser)) {
      const first = items[0]
      const userEmail = first.user_email

      // Get display name from users table
      const { data: u } = await admin
        .from('users')
        .select('name')
        .eq('id', first.user_id)
        .maybeSingle()
      const recipientName = u?.name ?? userEmail.split('@')[0]

      const html = digestEmailHtml({
        recipientName,
        orgName:  orgNameMap[orgId] ?? 'Your organisation',
        slot,
        items:    items.map(i => ({
          eventType: i.event_type,
          subject:   i.subject,
          createdAt: i.created_at,
        })),
        appUrl:   APP_URL,
      })

      const slotLabel = slot === 'morning' ? '8 AM' : '6 PM'

      try {
        await resend.emails.send({
          from:    FROM,
          to:      userEmail,
          subject: `📬 Floatup digest (${slotLabel} IST) — ${items.length} update${items.length === 1 ? '' : 's'}`,
          html,
        })
        sentIds.push(...items.map(i => i.id))
        totalSent++
      } catch (err) {
        console.error('[digest] Failed to send to', userEmail, err)
      }
    }

    if (sentIds.length) await markQueueSent(sentIds)
  }

  return { sent: totalSent, orgs: digestOrgIds.length }
}

// ── Morning digest — 8:00 AM IST (2:30 AM UTC) ───────────────────────────
export const digestMorning = inngest.createFunction(
  { id: 'digest-morning', name: 'Morning digest (8 AM IST)' },
  { cron: 'TZ=Asia/Kolkata 0 8 * * *' },
  async () => runDigest('morning')
)

// ── Evening digest — 6:00 PM IST (12:30 PM UTC) ──────────────────────────
export const digestEvening = inngest.createFunction(
  { id: 'digest-evening', name: 'Evening digest (6 PM IST)' },
  { cron: 'TZ=Asia/Kolkata 0 18 * * *' },
  async () => runDigest('evening')
)
