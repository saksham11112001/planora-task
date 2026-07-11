import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend, FROM }      from '@/lib/email/resend'
import { ENGAGEMENT_ITEMS }  from '@/lib/email/engagementContent'
import { engagementEmailHtml, engagementEmailText, engagementEmailSubject } from '@/lib/email/templates/engagementEmail'
import { marketingUnsubUrl } from '@/lib/email/marketingToken'

/**
 * Weekly engagement email — Tuesday 10:30 AM IST (good open-rate slot,
 * clear of the Monday scramble and the 8:15 digest).
 *
 * Behaviour:
 *  - Recipients: active owners/admins of any org (the decision makers),
 *    deduped across orgs, excluding marketing_opt_out users.
 *  - Each user gets the FIRST catalogue item they haven't received yet
 *    (marketing_email_log tracks per-user history), so two users who joined
 *    at different times are simply at different points of the same journey —
 *    and nobody ever gets a repeat. 102 items ≈ two years of weekly content.
 *  - Cadence: ENGAGEMENT_CADENCE_WEEKS env (default 1 = weekly; set 2 for
 *    biweekly — odd ISO weeks are skipped).
 *  - Sends are error-checked (the Brevo wrapper RETURNS errors); a failed
 *    send is not logged, so it retries next run.
 */
export const engagementEmails = inngest.createFunction(
  { id: 'engagement-weekly', name: 'Weekly engagement email (Tue 10:30 IST)', concurrency: { limit: 1 } },
  { cron: 'TZ=Asia/Kolkata 30 10 * * 2' },
  async ({ step }) => {
    const cadence = Math.max(1, parseInt(process.env.ENGAGEMENT_CADENCE_WEEKS ?? '1', 10) || 1)
    if (cadence > 1) {
      const week = Math.floor(Date.now() / (7 * 86400_000))
      if (week % cadence !== 0) return { skipped: 'off-week', cadence }
    }

    const admin = createAdminClient()

    // 1. Recipients: owners + admins with active memberships, deduped
    const recipients = await step.run('fetch-recipients', async () => {
      const { data } = await admin
        .from('org_members')
        .select('user_id, users!org_members_user_id_fkey(id, name, email, marketing_opt_out)')
        .in('role', ['owner', 'admin'])
        .eq('is_active', true)
        .limit(2000)
      const seen = new Set<string>()
      const out: { id: string; name: string; email: string }[] = []
      for (const m of data ?? []) {
        const u = (m as any).users
        if (!u?.email || seen.has(u.id)) continue
        seen.add(u.id)
        if (u.marketing_opt_out) continue
        out.push({ id: u.id, name: (u.name as string)?.split(' ')[0] || 'there', email: u.email })
      }
      return out
    })
    if (!recipients.length) return { sent: 0 }

    // 2. Sent history for all recipients in one query
    const historyByUser = await step.run('fetch-history', async () => {
      const { data } = await admin
        .from('marketing_email_log')
        .select('user_id, template_id')
        .in('user_id', recipients.map(r => r.id))
      const map: Record<string, string[]> = {}
      for (const row of data ?? []) (map[row.user_id] ??= []).push(row.template_id)
      return map
    })

    // 3. Send — capped per run to keep within Brevo daily limits
    const MAX_PER_RUN = 500
    let sent = 0, exhausted = 0

    for (const r of recipients) {
      if (sent >= MAX_PER_RUN) break
      const already = new Set(historyByUser[r.id] ?? [])
      const item = ENGAGEMENT_ITEMS.find(i => !already.has(i.id))
      if (!item) { exhausted++; continue }   // finished the whole catalogue

      await step.run(`send-${r.id}-${item.id}`, async () => {
        const unsubscribeUrl = marketingUnsubUrl(r.id)
        const { error } = await resend.emails.send({
          from:    FROM,
          to:      r.email,
          subject: engagementEmailSubject(item),
          html:    engagementEmailHtml(item, { recipientName: r.name, unsubscribeUrl }),
          text:    engagementEmailText(item, { recipientName: r.name, unsubscribeUrl }),
        }) ?? {}
        if (error) {
          console.error('[engagement] send failed for', r.email, '—', error)
          return // not logged → retries next week
        }
        const { error: logErr } = await admin.from('marketing_email_log')
          .insert({ user_id: r.id, template_id: item.id })
        if (logErr) console.error('[engagement] log insert failed:', logErr.message)
        sent++
      })
    }

    return { recipients: recipients.length, sent, exhausted }
  }
)
