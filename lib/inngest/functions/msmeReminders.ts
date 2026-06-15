import { inngest }              from '@/lib/inngest/client'
import { createAdminClient }    from '@/lib/supabase/admin'
import { sendMsmeVendorEmail }  from '@/lib/email/send'
import { DEFAULT_EMAIL_SCHEDULE } from '@/app/api/msme/settings/route'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://floatup.app'

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

    // Fetch all vendors still awaiting submission who have received at least 1 email
    const vendors = await step.run('fetch-pending-vendors', async () => {
      const { data } = await admin
        .from('msme_vendors')
        .select('id, vendor_name, vendor_email, org_id, email_count, last_emailed_at, organisations(name)')
        .eq('status', 'emailed')
        .gte('email_count', 1)
        .lte('email_count', 4)  // max 5 emails (email_count 1–4 still have follow-ups pending)
        .not('last_emailed_at', 'is', null)
      return data ?? []
    })

    if (vendors.length === 0) return { vendors_checked: 0, emails_sent: 0 }

    // Fetch schedule configs for all orgs that have vendors due
    const orgIds = [...new Set(vendors.map(v => v.org_id))]
    const scheduleMap = await step.run('fetch-org-schedules', async () => {
      const { data } = await admin
        .from('org_feature_settings')
        .select('org_id, config')
        .eq('feature_key', 'msme_email_schedule')
        .in('org_id', orgIds)
      const map: Record<string, number[]> = {}
      for (const row of data ?? []) {
        if (Array.isArray(row.config?.days)) map[row.org_id] = row.config.days
      }
      return map
    })

    let emailsSent = 0

    await step.run('send-due-reminders', async () => {
      for (const vendor of vendors) {
        const intervalDays: number[] = scheduleMap[vendor.org_id] ?? DEFAULT_EMAIL_SCHEDULE
        const maxEmails = intervalDays.length + 1  // email 1 is the initial shoot

        // vendor.email_count is the number already sent; if it's >= maxEmails, skip
        if (vendor.email_count >= maxEmails) continue

        // How many days to wait after the last email before sending the next
        const daysToWait = intervalDays[vendor.email_count - 1]
        if (daysToWait == null) continue

        const lastEmailed  = new Date(vendor.last_emailed_at!)
        const sendAfter    = new Date(lastEmailed.getTime() + daysToWait * 86400_000)

        // Only send if we're on or past the due date (but not more than 1 day over, to avoid re-sending)
        const oneDayMs = 86400_000
        if (now < sendAfter || now.getTime() - sendAfter.getTime() > oneDayMs) continue

        const orgName = (vendor.organisations as any)?.name ?? 'Your firm'
        const attemptNo = (vendor.email_count + 1) as 2 | 3 | 4 | 5

        // Generate fresh magic-link token
        const tokenRes = await fetch(`${APP_URL}/api/msme/tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-inngest-secret': process.env.INNGEST_SIGNING_KEY ?? '' },
          body: JSON.stringify({ vendor_id: vendor.id }),
        })
        let formUrl = `${APP_URL}/msme/form/${vendor.id}`
        if (tokenRes.ok) {
          const { token } = await tokenRes.json()
          formUrl = `${APP_URL}/msme/form/${token}`
        }

        try {
          await sendMsmeVendorEmail({
            to: vendor.vendor_email,
            vendorName: vendor.vendor_name,
            orgName,
            formUrl,
            attemptNo,
            totalEmails: maxEmails,
          })
          await admin.from('msme_vendors').update({
            email_count: attemptNo,
            last_emailed_at: new Date().toISOString(),
          }).eq('id', vendor.id)
          await admin.from('msme_email_log').insert({
            vendor_id: vendor.id, org_id: vendor.org_id, attempt_no: attemptNo,
          })
          emailsSent++
        } catch (e) {
          console.error('[msme-reminders] send failed', vendor.id, e)
        }
      }
    })

    return { vendors_checked: vendors.length, emails_sent: emailsSent }
  }
)
