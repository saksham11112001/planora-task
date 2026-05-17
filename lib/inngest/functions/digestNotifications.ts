import { inngest }              from '../client'
import { createAdminClient }    from '@/lib/supabase/admin'
import { markQueueSent }        from '@/lib/email/queue'
import { digestEmailHtml }      from '@/lib/email/templates/digestEmail'
import { resend, FROM }         from '@/lib/email/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taska.in'

async function runDigest(slot: 'morning' | 'evening') {
  const admin = createAdminClient()

  // Fetch all pending queue items — items are only queued for digest-mode orgs
  // (digest is now the default; immediate-mode orgs send directly and never queue).
  const { data: pending } = await admin
    .from('notification_queue')
    .select('id, org_id, user_id, user_email, event_type, subject, created_at')
    .is('sent_at', null)
    .order('created_at', { ascending: true })

  if (!pending?.length) return { sent: 0, orgs: 0 }

  // Fetch org names for all orgs that have pending items
  const orgIds = [...new Set(pending.map(r => r.org_id))]
  const { data: orgs } = await admin
    .from('organisations')
    .select('id, name')
    .in('id', orgIds)
  const orgNameMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name as string]))

  // Group by org → user
  const byOrg: Record<string, typeof pending> = {}
  for (const item of pending) {
    if (!byOrg[item.org_id]) byOrg[item.org_id] = []
    byOrg[item.org_id].push(item)
  }

  let totalSent = 0
  const allSentIds: string[] = []

  for (const [orgId, orgItems] of Object.entries(byOrg)) {
    // Group by user
    const byUser: Record<string, typeof orgItems> = {}
    for (const item of orgItems) {
      if (!byUser[item.user_id]) byUser[item.user_id] = []
      byUser[item.user_id].push(item)
    }

    for (const [, items] of Object.entries(byUser)) {
      const first = items[0]
      const userEmail = first.user_email

      const { data: u } = await admin
        .from('users')
        .select('name')
        .eq('id', first.user_id)
        .maybeSingle()
      const recipientName = (u as any)?.name ?? userEmail.split('@')[0]

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
        allSentIds.push(...items.map(i => i.id))
        totalSent++
      } catch (err) {
        console.error('[digest] Failed to send to', userEmail, err)
      }
    }
  }

  if (allSentIds.length) await markQueueSent(allSentIds)

  return { sent: totalSent, orgs: orgIds.length }
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
