import { inngest }              from '../client'
import { createAdminClient }    from '@/lib/supabase/admin'
import { markQueueSent }        from '@/lib/email/queue'
import { digestEmailHtml }      from '@/lib/email/templates/digestEmail'
import { FROM }                 from '@/lib/email/resend'
import { sendAppUsageEmail }    from '@/lib/email/audience'
import { chunk, PAGE_SIZE }     from '@/lib/supabase/fetchAll'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

/**
 * A digest is "here is what happened since the last one". An item that has sat
 * unsent for days is not news, and nobody wants a Tuesday summary on Friday.
 * Dropping stale items is what stops the queue becoming permanent: a failed
 * send leaves its rows queued, so without this the backlog only ever grows.
 */
const STALE_AFTER_DAYS = 3

/**
 * Ceiling on one run.
 *
 * This function had none, and it took production down. Sends had been failing
 * for days (a wrong SMTP port), and a failed send deliberately leaves its rows
 * queued — so the queue grew every run while every run re-read all of it. The
 * first run after the port was fixed tried to clear the whole backlog at once:
 * it ran for 9m24s, saturated the database, and the site returned 504 on every
 * route until the instance was restarted.
 *
 * Whatever does not fit goes out on the next slot, twelve hours later.
 *
 * Sized to PAGE_SIZE deliberately. PostgREST caps a response at max-rows and
 * truncates in silence, so a `.limit()` above that is a number this code would
 * believe and never actually receive.
 */
const MAX_ITEMS_PER_RUN = PAGE_SIZE

/**
 * Ceiling on the stale-row cleanup.
 *
 * An unbounded `DELETE ... WHERE created_at < cutoff` is itself unbounded work,
 * and on the backlog this exists to clear it would be the slowest statement in
 * the run — which defeats the point of having a cap at all. Ids are read first
 * (bounded, index-driven) and deleted by primary key in chunks. A backlog
 * larger than this drains over the following runs instead of in one go.
 */
const MAX_STALE_DELETE_PER_RUN = PAGE_SIZE

/**
 * Wall-clock budget for the send loop.
 *
 * The item cap alone does not bound how LONG a run takes: 2,000 items can be
 * 2,000 distinct recipients, and each send is a sequential call to Brevo. Run
 * duration is the thing that actually hurt — a job that holds connections for
 * ten minutes is the outage, whatever the row count was. When the budget runs
 * out we stop and leave the remainder queued, exactly as a failed send does.
 */
const SEND_BUDGET_MS = 4 * 60_000

/**
 * Stop after this many consecutive send failures.
 *
 * When the mail provider is misconfigured or down, every send fails the same
 * way — which is the state this system was actually in for days, on a wrong
 * SMTP port. Without this, the run spends its entire budget being refused, one
 * timeout at a time. Nothing is lost by stopping early: failed items stay
 * queued regardless, and the next slot retries them.
 */
const MAX_CONSECUTIVE_FAILURES = 10

async function runDigest(slot: 'morning' | 'evening') {
  const admin = createAdminClient()
  const deadline = Date.now() + SEND_BUDGET_MS

  const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000).toISOString()

  // Clear anything too old to be worth sending BEFORE reading. Otherwise a
  // backlog of undeliverable rows is re-read, re-grouped and re-attempted on
  // every run for ever, and it is exactly that work which grows without bound.
  const { data: stale } = await admin
    .from('notification_queue')
    .select('id')
    .is('sent_at', null)
    .lt('created_at', staleCutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_STALE_DELETE_PER_RUN)

  if (stale?.length) {
    for (const ids of chunk(stale.map(r => r.id))) {
      const { error } = await admin.from('notification_queue').delete().in('id', ids)
      if (error) console.error('[digest] stale cleanup failed:', error.message)
    }
    console.warn(`[digest] dropped ${stale.length} queued item(s) older than ${STALE_AFTER_DAYS} days`)
  }

  // Fetch pending queue items — items are only queued for digest-mode orgs
  // (digest is now the default; immediate-mode orgs send directly and never queue).
  // Oldest first and capped, so a spike is spread across slots rather than
  // attempted in one run.
  const { data: pending } = await admin
    .from('notification_queue')
    .select('id, org_id, user_id, user_email, event_type, subject, created_at')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(MAX_ITEMS_PER_RUN)

  if (!pending?.length) return { sent: 0, orgs: 0, stoppedEarly: null }

  // Org and recipient names, both resolved in batches BEFORE the send loop.
  //
  // The recipient name used to come from a `users` lookup inside the per-user
  // loop: one sequential round trip per recipient, before that recipient's
  // (also sequential) email. On a backlog that is hundreds of queries standing
  // between the start of the run and the last message, and a large part of why
  // the 6 PM run took 9m24s.
  //
  // Both lists are chunked: a few thousand UUIDs in one `.in()` overrun the URL
  // length limit and come back 414, which reads here as "no names found" and
  // would quietly address every digest to the email local-part instead.
  const orgIds  = [...new Set(pending.map(r => r.org_id))]
  const userIds = [...new Set(pending.map(r => r.user_id))]

  const orgNameMap: Record<string, string> = {}
  for (const ids of chunk(orgIds)) {
    const { data: orgs, error } = await admin.from('organisations').select('id, name').in('id', ids)
    if (error) console.error('[digest] org name lookup failed:', error.message)
    for (const o of orgs ?? []) orgNameMap[o.id as string] = o.name as string
  }

  const userNameMap: Record<string, string> = {}
  for (const ids of chunk(userIds)) {
    const { data: us, error } = await admin.from('users').select('id, name').in('id', ids)
    if (error) console.error('[digest] recipient name lookup failed:', error.message)
    for (const u of us ?? []) userNameMap[u.id as string] = (u as any).name
  }

  // Group by org → user
  const byOrg: Record<string, typeof pending> = {}
  for (const item of pending) {
    if (!byOrg[item.org_id]) byOrg[item.org_id] = []
    byOrg[item.org_id].push(item)
  }

  let totalSent = 0
  let consecutiveFailures = 0
  let stoppedEarly: 'budget' | 'failures' | null = null
  const allSentIds: string[] = []

  sending:
  for (const [orgId, orgItems] of Object.entries(byOrg)) {
    // Group by user
    const byUser: Record<string, typeof orgItems> = {}
    for (const item of orgItems) {
      if (!byUser[item.user_id]) byUser[item.user_id] = []
      byUser[item.user_id].push(item)
    }

    for (const [, items] of Object.entries(byUser)) {
      if (Date.now() > deadline)                            { stoppedEarly = 'budget';   break sending }
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES)  { stoppedEarly = 'failures'; break sending }

      const first = items[0]
      const userEmail = first.user_email

      const recipientName = userNameMap[first.user_id] ?? userEmail.split('@')[0]

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
        // The Brevo wrapper RETURNS errors rather than throwing — check the
        // result explicitly. Marking items sent on a failed send silently
        // destroys the user's digest (it never retries).
        // Product-gated: the digest is upFloat task-manager usage email, so it
        // is skipped for MSME-only / partner-only users (reported as success,
        // which correctly clears their queue instead of retrying forever).
        const { error: sendErr } = await sendAppUsageEmail({
          from:    FROM,
          to:      userEmail,
          subject: `📬 upFloat digest (${slotLabel} IST) — ${items.length} update${items.length === 1 ? '' : 's'}`,
          html,
        }) ?? {}
        if (sendErr) {
          consecutiveFailures++
          console.error('[digest] Brevo rejected send to', userEmail, '—', sendErr, '(items left queued for next slot)')
        } else {
          consecutiveFailures = 0
          allSentIds.push(...items.map(i => i.id))
          totalSent++
        }
      } catch (err) {
        consecutiveFailures++
        console.error('[digest] Failed to send to', userEmail, err, '(items left queued for next slot)')
      }
    }
  }

  // Mark sent in chunks for the `.in()` URL-length reason above. A 414 here
  // would leave delivered digests looking unsent, and the next slot would send
  // every one of them again.
  if (allSentIds.length) {
    for (const ids of chunk(allSentIds)) await markQueueSent(ids)
  }

  if (stoppedEarly === 'budget') {
    console.warn(`[digest] send budget (${SEND_BUDGET_MS / 1000}s) reached after ${totalSent} digest(s) — remainder stays queued for the next slot`)
  } else if (stoppedEarly === 'failures') {
    console.error(`[digest] stopped after ${MAX_CONSECUTIVE_FAILURES} consecutive send failures — mail delivery looks broken, check SMTP config`)
  }

  return { sent: totalSent, orgs: orgIds.length, stoppedEarly }
}

// ── Morning digest — 8:15 AM IST ─────────────────────────────────────────
// Intentionally 15 min after dailyReminders (8:00 AM IST) so that all
// due-soon / escalation / approval items queued by that job are captured
// in this flush rather than deferred to the evening slot.
export const digestMorning = inngest.createFunction(
  { id: 'digest-morning', name: 'Morning digest (8:15 AM IST)' },
  { cron: 'TZ=Asia/Kolkata 15 8 * * *' },
  async () => runDigest('morning')
)

// ── Evening digest — 6:00 PM IST (12:30 PM UTC) ──────────────────────────
export const digestEvening = inngest.createFunction(
  { id: 'digest-evening', name: 'Evening digest (6 PM IST)' },
  { cron: 'TZ=Asia/Kolkata 0 18 * * *' },
  async () => runDigest('evening')
)
