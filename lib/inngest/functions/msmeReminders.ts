import { inngest }              from '@/lib/inngest/client'
import { createAdminClient }    from '@/lib/supabase/admin'
import { sendMsmeVendorEmail }  from '@/lib/email/send'
import { DEFAULT_EMAIL_SCHEDULE } from '@/lib/msme/emailSchedule'
import { describePeriod }       from '@/lib/msme/periods'
import { getPreviousDeclarations } from '@/lib/msme/declarations'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

// Daily cron — 10 AM IST — sends automated follow-up emails to vendors
// who still haven't submitted, based on each org's configured schedule.
// Email #1 is fired immediately when the firm clicks "Shoot email".
// Emails #2–5 are sent automatically at intervals the firm configures.
//
// HALF-YEARLY: chases are tracked per reporting period. The cron iterates
// msme_declarations, not msme_vendors, because the counters mean different
// things on each — msme_declarations.email_count restarts every half-year,
// while msme_vendors.email_count is the lifetime billing ledger and never
// resets. Driving the cron off the vendor row would have made a vendor chased
// to the cap in September unreachable for March. See lib/msme/declarations.ts.
export const msmeReminders = inngest.createFunction(
  { id: 'msme-reminders', name: 'MSME — vendor reminder emails' },
  { cron: 'TZ=Asia/Kolkata 0 10 * * *' },
  async ({ step }) => {
    const admin = createAdminClient()
    const now   = new Date()

    // The shape of one open chase. Declared explicitly because PostgREST's
    // generated types cannot infer an embedded select written as a string, and
    // infer a union with GenericStringError instead.
    type PendingRow = {
      id:              string
      vendor_id:       string
      org_id:          string
      period_end:      string
      email_count:     number
      last_emailed_at: string
      vendor: {
        id: string; vendor_name: string; vendor_email: string; email_count: number
      } | null
    }

    // Every open chase, for any period, whose vendor is still active and
    // contactable.
    const pending = await step.run('fetch-pending-declarations', async () => {
      const { data, error } = await admin
        .from('msme_declarations')
        .select(
          'id, vendor_id, org_id, period_end, email_count, last_emailed_at, ' +
          // Never auto-remind a vendor who unsubscribed or whose address
          // bounced. Every send to a dead address chips away at sender
          // reputation, pushing ALL of the firm's vendor mail towards spam.
          //
          // !inner so a declaration belonging to a deleted or bounced vendor
          // is removed by the JOIN, before the 500-row cap. Filtering in JS
          // afterwards would let a backlog of bounced vendors — who keep
          // status 'emailed' forever — occupy the whole cap and starve the
          // chases that should actually go out.
          //
          // No FK hint is needed: msme_declarations has exactly one foreign
          // key to msme_vendors, so the embed is unambiguous.
          'vendor:msme_vendors!inner(' +
            'id, vendor_name, vendor_email, email_count, is_deleted, email_bounced)'
        )
        .eq('status', 'emailed')
        .eq('vendor.is_deleted', false)
        .eq('vendor.email_bounced', false)
        .gte('email_count', 1)
        .lte('email_count', 4)  // max 5 emails (1–4 still have follow-ups pending)
        .not('last_emailed_at', 'is', null)
        // Oldest chase first, and a deterministic order so the 500-row cap
        // takes a stable slice. Without an order the cap chose arbitrary rows,
        // so a vendor could be skipped run after run while others were
        // re-examined every night.
        .order('last_emailed_at', { ascending: true })
        .limit(500)  // cap per run to stay within Inngest 4MB step result limit

      // Surfaced, not swallowed. This query is the only thing standing between
      // vendors and their follow-ups: if it fails the job returns "0 emails
      // sent", which is indistinguishable from "nothing was due" unless the
      // failure is logged.
      if (error) {
        console.error('[msme-reminders] pending-declaration query failed:', error.message)
        return [] as PendingRow[]
      }
      return (data ?? []) as unknown as PendingRow[]
    })

    // Flatten the join so the loop below reads the same way it used to.
    // A row whose vendor did not come back is dropped rather than guessed at:
    // !inner should make that impossible, and sending without the vendor's
    // address is not something to attempt on a fallback.
    const vendors = pending.flatMap(d => d.vendor ? [{
      declaration_id:  d.id,
      period_end:      d.period_end,
      period_count:    d.email_count,
      last_emailed_at: d.last_emailed_at,
      id:              d.vendor.id,
      vendor_name:     d.vendor.vendor_name,
      vendor_email:    d.vendor.vendor_email,
      lifetime_count:  d.vendor.email_count,
      org_id:          d.org_id,
    }] : [])

    if (vendors.length === 0) return { vendors_checked: 0, emails_sent: 0 }

    // Fetch schedule configs, CC email, and contact person settings for all orgs that have vendors due
    const orgIds = [...new Set(vendors.map(v => v.org_id))]
    const { scheduleMap, ccMap, contactMap, orgNameMap } = await step.run('fetch-org-settings', async () => {
      const [{ data: schedRows }, { data: ccRows }, { data: contactRows }, { data: orgRows }] = await Promise.all([
        admin
          .from('org_feature_settings')
          .select('org_id, config')
          .eq('feature_key', 'msme_email_schedule')
          .in('org_id', orgIds),
        admin
          .from('org_feature_settings')
          .select('org_id, config')
          .eq('feature_key', 'msme_cc_email')
          .in('org_id', orgIds),
        admin
          .from('org_feature_settings')
          .select('org_id, config')
          .eq('feature_key', 'msme_contact_person')
          .in('org_id', orgIds),
        // Fetched here rather than as a nested embed under the vendor join —
        // the email's From name and sign-off are the requesting firm's.
        admin.from('organisations').select('id, name').in('id', orgIds),
      ])
      const orgNameMap: Record<string, string> = {}
      for (const row of orgRows ?? []) orgNameMap[row.id] = row.name ?? ''
      const scheduleMap: Record<string, number[]> = {}
      for (const row of schedRows ?? []) {
        if (Array.isArray(row.config?.days)) scheduleMap[row.org_id] = row.config.days
      }
      const ccMap: Record<string, string | undefined> = {}
      for (const row of ccRows ?? []) {
        const email = (row.config as { email?: string } | null)?.email
        if (email) ccMap[row.org_id] = email
      }
      const contactMap: Record<string, { name?: string; email?: string; phone?: string } | null> = {}
      for (const row of contactRows ?? []) {
        contactMap[row.org_id] = (row.config as { name?: string; email?: string; phone?: string } | null) ?? null
      }
      return { scheduleMap, ccMap, contactMap, orgNameMap }
    })

    // Which of these vendors declared in an earlier cycle — drives the email's
    // "your details are already on file" framing. One query for the batch.
    const previous = await step.run('fetch-previous-declarations', async () => {
      // Grouped by period: the carry-forward lookup is "latest declaration
      // before THIS period", which differs per period in the batch.
      const byPeriod = new Map<string, string[]>()
      for (const v of vendors) {
        const list = byPeriod.get(v.period_end) ?? []
        list.push(v.id)
        byPeriod.set(v.period_end, list)
      }
      const out: Record<string, boolean> = {}
      for (const [periodEnd, ids] of byPeriod) {
        const map = await getPreviousDeclarations(admin, ids, periodEnd)
        for (const [vendorId, decl] of map) {
          if (decl.submitted_at) out[`${vendorId}__${periodEnd}`] = true
        }
      }
      return out
    })

    let emailsSent = 0

    // Process each vendor in its own step so a failure doesn't block others
    // and so Inngest can checkpoint progress (prevents timeout on large batches)
    for (const vendor of vendors) {
      const intervalDays: number[] = scheduleMap[vendor.org_id] ?? DEFAULT_EMAIL_SCHEDULE
      const maxEmails = intervalDays.length + 1

      // The cap counts THIS period's chases. Counting the vendor's lifetime
      // total would leave a vendor chased to the cap in September permanently
      // unreachable for March.
      if (vendor.period_count >= maxEmails) continue

      // Schedule values are DAY OFFSETS from the first email (day 7, 14, 21,
      // 30 by default). The wait after the previous send is therefore the
      // DIFFERENCE between consecutive offsets. Treating each value as a gap
      // (the old reading) compounded them: [7,14,21,30] actually sent on days
      // 7, 21, 42 and 72 — the "final reminder" landing two months after the
      // 15-day reply window the email itself quotes. Clamped to ≥1 day so a
      // non-increasing custom schedule can never machine-gun a vendor.
      const offset     = intervalDays[vendor.period_count - 1]
      if (offset == null) continue
      const prevOffset = vendor.period_count >= 2 ? (intervalDays[vendor.period_count - 2] ?? 0) : 0
      const daysToWait = Math.max(1, offset - prevOffset)

      const lastEmailed = new Date(vendor.last_emailed_at!)
      const sendAfter   = new Date(lastEmailed.getTime() + daysToWait * 86400_000)
      if (now < sendAfter) continue

      // Keyed by period too: one vendor can have an open chase for more than
      // one half-year, and Inngest step ids must be unique within a run.
      const sent = await step.run(`send-reminder-${vendor.id}-${vendor.period_end}`, async () => {
        const orgName   = orgNameMap[vendor.org_id] || 'Your firm'
        const period    = describePeriod(vendor.period_end)
        const attemptNo = Math.min(vendor.period_count + 1, 5) as 2 | 3 | 4 | 5

        const tokenRes = await fetch(`${APP_URL}/api/msme/tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-msme-internal-secret': process.env.MSME_INTERNAL_SECRET ?? '' },
          // The link must be bound to the period being chased, or the vendor
          // could file these figures against the wrong half-year.
          body: JSON.stringify({ vendor_id: vendor.id, period_end: vendor.period_end }),
        })
        if (!tokenRes.ok) {
          console.error('[msme-reminders] token mint failed for vendor', vendor.id, await tokenRes.text())
          return false
        }
        const { token } = await tokenRes.json()
        const formUrl = `${APP_URL}/msme/form/${token}`
        const contactPerson = contactMap[vendor.org_id] ?? null

        try {
          const { error: sendErr } = await sendMsmeVendorEmail({
            to:           vendor.vendor_email,
            vendorName:   vendor.vendor_name,
            orgName,
            formUrl,
            attemptNo,
            totalEmails:  maxEmails,
            cc:           ccMap[vendor.org_id],
            contactName:  contactPerson?.name,
            contactEmail: contactPerson?.email,
            contactPhone: contactPerson?.phone,
            asOn:         period.asOn,
            periodLabel:  period.rangeLabel,
            isReturning:  !!previous[`${vendor.id}__${vendor.period_end}`],
          }) ?? {}
          if (sendErr) { console.error('[msme-reminders] send failed', vendor.id, sendErr); return false }

          const sentAt = new Date().toISOString()
          // This period's chase counter.
          await admin.from('msme_declarations').update({
            email_count: attemptNo, last_emailed_at: sentAt,
          }).eq('id', vendor.declaration_id)
          // The vendor row's lifetime slot ledger: incremented, never set to a
          // per-period value and never reset, because every slot gate counts
          // rows where email_count > 0.
          await admin.from('msme_vendors').update({
            email_count: vendor.lifetime_count + 1, last_emailed_at: sentAt,
          }).eq('id', vendor.id)
          await admin.from('msme_email_log').insert({
            vendor_id: vendor.id, org_id: vendor.org_id, attempt_no: attemptNo,
            period_end: vendor.period_end,
          })
          return true
        } catch (e) {
          console.error('[msme-reminders] send failed', vendor.id, e)
          return false
        }
      })
      if (sent) emailsSent++
    }

    return { vendors_checked: vendors.length, emails_sent: emailsSent }
  }
)
