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
import { classifyBounce }           from '@/lib/msme/bounceKind'
import type { BounceKind }          from '@/lib/msme/bounceKind'
import crypto                       from 'crypto'

const BOUNCE_EVENTS = new Set(['hard_bounce', 'soft_bounce', 'spam', 'invalid_email'])
const OPEN_EVENTS   = new Set(['opened', 'unique_opened', 'proxy_open'])

export async function POST(req: NextRequest) {
  // Fail CLOSED. The check used to be skipped entirely when
  // BREVO_WEBHOOK_SECRET was unset, which left an unauthenticated endpoint that
  // marks vendors email_bounced = true. Anyone who found it could permanently
  // suppress a firm's entire vendor outreach — the reminder cron and both send
  // routes all refuse to email a bounced vendor — and nothing in the product
  // would explain why the emails had stopped.
  const configured = process.env.BREVO_WEBHOOK_SECRET
  if (!configured) {
    console.error('[msme/bounce-webhook] BREVO_WEBHOOK_SECRET is not set — rejecting')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const secret = req.nextUrl.searchParams.get('secret')
  const provided = Buffer.from(secret ?? '')
  const expected = Buffer.from(configured)
  const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
  if (!ok) {
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

    // What kind of failure this is decides whether the vendor is BLOCKED or
    // merely had a bad day.
    //
    // The SMTP text wins when it is decisive, because the code in it comes
    // from the receiving server itself; the event name is Brevo's own
    // bucketing and is the fallback. A spam complaint overrides both: the
    // remedy there is stricter than for a bad address, and some servers wrap
    // a complaint in an ordinary 5xx.
    const fromText = classifyBounce(reason)
    const kind: BounceKind =
      event === 'spam'                                        ? 'spam'
      : fromText !== 'unknown'                                ? fromText
      : event === 'soft_bounce'                               ? 'soft'
      : event === 'hard_bounce' || event === 'invalid_email'  ? 'hard'
      : 'unknown'

    // email_bounced means "never email this address again", and every send
    // path filters on it. A full mailbox is not that: the address is correct
    // and will accept mail once there is room, so recording it as a block
    // silenced the vendor for ever. The reason is still stored, so the screen
    // can show what happened without the vendor becoming unreachable.
    const blocks = kind !== 'soft'

    // Update all vendors with this email across all orgs — one email may appear in multiple orgs
    const { data: updated } = await admin
      .from('msme_vendors')
      .update({ email_bounced: blocks, bounce_reason: reason })
      .eq('vendor_email', email)
      // Idempotent, and it also stops a later soft bounce from clearing a
      // block that an earlier opt-out or hard bounce put there.
      .eq('email_bounced', false)
      .select('id')

    if (blocks) marked += updated?.length ?? 0
  }

  return NextResponse.json({ ok: true, marked, opens })
}
