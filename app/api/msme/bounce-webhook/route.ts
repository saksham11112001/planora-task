// Brevo transactional webhook — receives bounce AND open events.
// Set this URL in Brevo: Transactional → Settings → Webhook
//   URL: https://your-domain.com/api/msme/bounce-webhook?secret=<BREVO_WEBHOOK_SECRET>
//   Events: Hard bounce, Soft bounce, Spam, Opened
//
// Bounces mark the vendor as bounced. Email count is NOT decremented —
// the slot is already consumed and this is the user's mistake for entering a bad address.
// Opens stamp msme_email_log.opened_at (served by /api/msme/email-logs).
// Deliberately NOT shown in the audit-log export — it's diagnostic data for
// telling "landed in spam" apart from "opened and ignored" when vendors go
// quiet, not a compliance record.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }        from '@/lib/supabase/admin'

const BOUNCE_EVENTS = new Set(['hard_bounce', 'soft_bounce', 'spam', 'invalid_email'])
const OPEN_EVENTS   = new Set(['opened', 'unique_opened', 'proxy_open'])

export async function POST(req: NextRequest) {
  // Basic secret check — add BREVO_WEBHOOK_SECRET to your Vercel env vars
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.BREVO_WEBHOOK_SECRET && secret !== process.env.BREVO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Brevo may send a single event object or an array of events
  const events: unknown[] = Array.isArray(body) ? body : [body]

  const admin = createAdminClient()
  let marked = 0
  let opens  = 0

  for (const evt of events) {
    if (!evt || typeof evt !== 'object') continue
    const e = evt as Record<string, unknown>
    const event = (e.event as string | undefined)?.toLowerCase()
    const email = (e.email as string | undefined)?.toLowerCase().trim()
    if (!event || !email) continue

    // ── Open events → stamp the latest unopened log row per matching vendor ──
    if (OPEN_EVENTS.has(event)) {
      const { data: vendorRows } = await admin
        .from('msme_vendors')
        .select('id')
        .eq('vendor_email', email)
      for (const v of vendorRows ?? []) {
        // Attribute the open to the most recent send that hasn't been opened
        // yet — Brevo's event doesn't say which attempt was opened, and the
        // latest unopened one is the only attribution that can't double-count.
        const { data: logRow } = await admin
          .from('msme_email_log')
          .select('id')
          .eq('vendor_id', v.id)
          .is('opened_at', null)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (logRow) {
          await admin.from('msme_email_log')
            .update({ opened_at: new Date().toISOString() })
            .eq('id', logRow.id)
          opens++
        }
      }
      continue
    }

    if (!BOUNCE_EVENTS.has(event)) continue

    const reason = typeof e.reason === 'string' ? e.reason
      : event === 'spam'         ? 'Marked as spam by recipient'
      : event === 'hard_bounce'  ? 'Hard bounce — address does not exist'
      : event === 'soft_bounce'  ? 'Soft bounce — mailbox temporarily unavailable'
      : event === 'invalid_email'? 'Invalid email address'
      : 'Delivery failed'

    // Update all vendors with this email across all orgs — one email may appear in multiple orgs
    const { data: updated } = await admin
      .from('msme_vendors')
      .update({ email_bounced: true, bounce_reason: reason })
      .eq('vendor_email', email)
      .eq('email_bounced', false) // idempotent
      .select('id')

    marked += updated?.length ?? 0
  }

  return NextResponse.json({ ok: true, marked, opens })
}
