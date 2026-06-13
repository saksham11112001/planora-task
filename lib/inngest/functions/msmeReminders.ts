import { inngest }              from '@/lib/inngest/client'
import { createAdminClient }    from '@/lib/supabase/admin'
import { sendMsmeVendorEmail }  from '@/lib/email/send'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://floatup.app'

// Daily cron — 10 AM IST — sends reminder #2 (day 7) and #3 (day 14) to vendors
// who still haven't submitted. Attempt #1 is fired immediately by the API route
// when the firm clicks "Shoot email".
export const msmeReminders = inngest.createFunction(
  { id: 'msme-reminders', name: 'MSME — vendor reminder emails' },
  { cron: 'TZ=Asia/Kolkata 0 10 * * *' },
  async ({ step }) => {
    const admin = createAdminClient()
    const now   = new Date()

    // ── Reminder #2: sent 7 days after first email, if still pending ──────
    const day7Cutoff = new Date(now.getTime() - 7  * 86400_000).toISOString()
    const day14Cutoff= new Date(now.getTime() - 14 * 86400_000).toISOString()
    // upper bound so we don't re-send tomorrow for the same vendor
    const day8Cutoff = new Date(now.getTime() - 8  * 86400_000).toISOString()
    const day15Cutoff= new Date(now.getTime() - 15 * 86400_000).toISOString()

    await step.run('send-reminder-2', async () => {
      const { data: vendors } = await admin
        .from('msme_vendors')
        .select('id, vendor_name, vendor_email, org_id, email_count, organisations(name)')
        .eq('status', 'emailed')
        .eq('email_count', 1)
        .gte('last_emailed_at', day8Cutoff)
        .lte('last_emailed_at', day7Cutoff)

      for (const v of vendors ?? []) {
        const orgName = (v.organisations as any)?.name ?? 'Your client'
        // Generate a fresh token for this vendor
        const tokenRes = await fetch(`${APP_URL}/api/msme/tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-inngest-secret': process.env.INNGEST_SIGNING_KEY ?? '' },
          body: JSON.stringify({ vendor_id: v.id }),
        })
        let formUrl = `${APP_URL}/msme/${v.id}`
        if (tokenRes.ok) {
          const { token } = await tokenRes.json()
          formUrl = `${APP_URL}/msme/form/${token}`
        }

        try {
          await sendMsmeVendorEmail({ to: v.vendor_email, vendorName: v.vendor_name, orgName, formUrl, attemptNo: 2 })
          await admin.from('msme_vendors').update({
            email_count: 2, last_emailed_at: new Date().toISOString(),
          }).eq('id', v.id)
          await admin.from('msme_email_log').insert({
            vendor_id: v.id, org_id: v.org_id, attempt_no: 2,
          })
        } catch (e) { console.error('[msme-reminders] r2 send failed', v.id, e) }
      }
    })

    // ── Reminder #3: sent 14 days after first email, if still pending ─────
    await step.run('send-reminder-3', async () => {
      const { data: vendors } = await admin
        .from('msme_vendors')
        .select('id, vendor_name, vendor_email, org_id, email_count, organisations(name)')
        .eq('status', 'emailed')
        .eq('email_count', 2)
        .gte('last_emailed_at', day15Cutoff)
        .lte('last_emailed_at', day14Cutoff)

      for (const v of vendors ?? []) {
        const orgName = (v.organisations as any)?.name ?? 'Your client'
        const tokenRes = await fetch(`${APP_URL}/api/msme/tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-inngest-secret': process.env.INNGEST_SIGNING_KEY ?? '' },
          body: JSON.stringify({ vendor_id: v.id }),
        })
        let formUrl = `${APP_URL}/msme/${v.id}`
        if (tokenRes.ok) {
          const { token } = await tokenRes.json()
          formUrl = `${APP_URL}/msme/form/${token}`
        }

        try {
          await sendMsmeVendorEmail({ to: v.vendor_email, vendorName: v.vendor_name, orgName, formUrl, attemptNo: 3 })
          await admin.from('msme_vendors').update({
            email_count: 3, last_emailed_at: new Date().toISOString(),
          }).eq('id', v.id)
          await admin.from('msme_email_log').insert({
            vendor_id: v.id, org_id: v.org_id, attempt_no: 3,
          })
        } catch (e) { console.error('[msme-reminders] r3 send failed', v.id, e) }
      }
    })
  }
)
