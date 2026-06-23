import { inngest }              from '@/lib/inngest/client'
import { createAdminClient }    from '@/lib/supabase/admin'
import { sendMsmeVendorEmail }  from '@/lib/email/send'
import { DEFAULT_EMAIL_SCHEDULE } from '@/app/api/msme/settings/route'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

// Daily cron — 10 AM IST — sends automated follow-up emails to vendors
// who still haven't submitted, based on each org's configured schedule.
// Email #1 is fired immediately when the firm clicks "Shoot email".
// Emails #2–5 are sent automatically at intervals the firm configures.
export const msmeReminders = inngest.createFunction(
  { id: 'msme-reminders', name: 'MSME — vendor reminder emails' },
  { cron: 'TZ=Asia/Kolkata 0 10 * * *' },
  async ({ step }) => {
    const admin = createAdminClient()
    const now   = new Date()

    // Fetch all active (non-deleted) vendors still awaiting submission who have received at least 1 email
    const vendors = await step.run('fetch-pending-vendors', async () => {
      const { data } = await admin
        .from('msme_vendors')
        .select('id, vendor_name, vendor_email, org_id, email_count, last_emailed_at, organisations(name)')
        .eq('status', 'emailed')
        .eq('is_deleted', false)
        .gte('email_count', 1)
        .lte('email_count', 4)  // max 5 emails (email_count 1–4 still have follow-ups pending)
        .not('last_emailed_at', 'is', null)
        .limit(500)  // cap per run to stay within Inngest 4MB step result limit
      return data ?? []
    })

    if (vendors.length === 0) return { vendors_checked: 0, emails_sent: 0 }

    // Fetch schedule configs, CC email, and contact person settings for all orgs that have vendors due
    const orgIds = [...new Set(vendors.map(v => v.org_id))]
    const { scheduleMap, ccMap, contactMap } = await step.run('fetch-org-settings', async () => {
      const [{ data: schedRows }, { data: ccRows }, { data: contactRows }] = await Promise.all([
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
      ])
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
      return { scheduleMap, ccMap, contactMap }
    })

    let emailsSent = 0

    // Process each vendor in its own step so a failure doesn't block others
    // and so Inngest can checkpoint progress (prevents timeout on large batches)
    for (const vendor of vendors) {
      const intervalDays: number[] = scheduleMap[vendor.org_id] ?? DEFAULT_EMAIL_SCHEDULE
      const maxEmails = intervalDays.length + 1

      if (vendor.email_count >= maxEmails) continue

      const daysToWait = intervalDays[vendor.email_count - 1]
      if (daysToWait == null) continue

      const lastEmailed = new Date(vendor.last_emailed_at!)
      const sendAfter   = new Date(lastEmailed.getTime() + daysToWait * 86400_000)
      if (now < sendAfter) continue

      const sent = await step.run(`send-reminder-${vendor.id}`, async () => {
        const orgName   = (vendor.organisations as any)?.name ?? 'Your firm'
        const attemptNo = Math.min(vendor.email_count + 1, 5) as 2 | 3 | 4 | 5

        const tokenRes = await fetch(`${APP_URL}/api/msme/tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-msme-internal-secret': process.env.MSME_INTERNAL_SECRET ?? '' },
          body: JSON.stringify({ vendor_id: vendor.id }),
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
          }) ?? {}
          if (sendErr) { console.error('[msme-reminders] send failed', vendor.id, sendErr); return false }
          await admin.from('msme_vendors').update({
            email_count: attemptNo,
            last_emailed_at: new Date().toISOString(),
          }).eq('id', vendor.id)
          await admin.from('msme_email_log').insert({
            vendor_id: vendor.id, org_id: vendor.org_id, attempt_no: attemptNo,
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
