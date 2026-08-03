// Send email invites from the standalone partner portal.
// Handles both 'msme' and 'partner' invite types.
//
// DELIVERABILITY NOTES (these invites go to people who have not opted in, so
// every signal matters — they were previously landing in spam):
//  - Always send a plain-text part alongside the HTML. HTML-only mail is one
//    of the strongest spam signals there is.
//  - Set Reply-To to the inviting partner's real address, so the mail leads
//    back to a human the recipient may actually know.
//  - Send List-Unsubscribe (mailto). Gmail/Outlook expect it on bulk-ish mail
//    and its absence hurts inbox placement.
//  - Keep the copy plain and specific. Money words ("earn", "commission",
//    "free"), shouty CTAs and emoji all push these into spam.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { resend, FROM }             from '@/lib/email/resend'

const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'
const SUPPORT_MAIL = 'support@upfloat.co'

// Escape partner-supplied values before interpolating into HTML.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const INVITE_HEADERS = {
  'List-Unsubscribe': `<mailto:${SUPPORT_MAIL}?subject=Unsubscribe>`,
}

/* ── MSME Tracker invite ──────────────────────────────────────────────────
   Explains, in plain English, what the product does: you upload your vendor
   list, it asks each vendor for their Udyam details, chases the ones who
   haven't replied, and leaves you with an audit log your CA can use. */
function msmeInviteHtml(partnerName: string, partnerEmail: string, msmeUrl: string): string {
  const p = esc(partnerName)
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;padding:28px 24px;">
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;">Hello,</p>

    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;">
      <strong>${p}</strong> thought MSME Tracker would be useful for your business, and asked us to send you this note.
    </p>

    <p style="margin:0 0 10px;font-size:15px;line-height:1.65;">
      <strong>What it is</strong><br>
      A simple tool that collects MSME (Udyam) declarations from your vendors and keeps them all in one place.
    </p>

    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;"><strong>How it works</strong></p>
    <ol style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.75;color:#334155;">
      <li>You upload your vendor list, or add vendors one at a time.</li>
      <li>Each vendor gets a short form asking whether they are registered as an MSME, and for their Udyam number.</li>
      <li>Vendors who do not reply receive polite reminders, so you are not left chasing them.</li>
      <li>You get an audit log showing who declared what, and on which date — ready to hand to your CA.</li>
    </ol>

    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;">
      <strong>Why it matters</strong><br>
      Under Section 43B(h), payments to MSME vendors must be settled within 45 days, or the expense is disallowed for that year.
      To apply the rule you first need to know which of your vendors are MSMEs — that is exactly the record this creates.
    </p>

    <p style="margin:0 0 24px;font-size:15px;line-height:1.65;">
      You can add up to 5 vendors without paying anything, to see whether it suits you.
    </p>

    <p style="margin:0 0 26px;">
      <a href="${msmeUrl}" style="color:#0d9488;font-size:15px;font-weight:600;">Open MSME Tracker &rarr;</a>
    </p>

    <p style="margin:0;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
      You received this because ${p} (${esc(partnerEmail)}) invited you. If it is not relevant, you can ignore this email
      and you will not hear from us again. Questions? Reply to this email or write to ${SUPPORT_MAIL}.<br>
      MSME Tracker is part of upFloat.
    </p>
  </div>
</body></html>`
}

function msmeInviteText(partnerName: string, partnerEmail: string, msmeUrl: string): string {
  return `Hello,

${partnerName} thought MSME Tracker would be useful for your business, and asked us to send you this note.

WHAT IT IS
A simple tool that collects MSME (Udyam) declarations from your vendors and keeps them all in one place.

HOW IT WORKS
1. You upload your vendor list, or add vendors one at a time.
2. Each vendor gets a short form asking whether they are registered as an MSME, and for their Udyam number.
3. Vendors who do not reply receive polite reminders, so you are not left chasing them.
4. You get an audit log showing who declared what, and on which date - ready to hand to your CA.

WHY IT MATTERS
Under Section 43B(h), payments to MSME vendors must be settled within 45 days, or the expense is disallowed for that year. To apply the rule you first need to know which of your vendors are MSMEs - that is exactly the record this creates.

You can add up to 5 vendors without paying anything, to see whether it suits you.

Open MSME Tracker: ${msmeUrl}

---
You received this because ${partnerName} (${partnerEmail}) invited you. If it is not relevant, you can ignore this email and you will not hear from us again.
Questions? Reply to this email or write to ${SUPPORT_MAIL}.
MSME Tracker is part of upFloat.`
}

/* ── Partner Program invite ─────────────────────────────────────────────── */
function partnerInviteHtml(partnerName: string, partnerEmail: string, joinUrl: string): string {
  const p = esc(partnerName)
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;padding:28px 24px;">
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;">Hello,</p>

    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;">
      <strong>${p}</strong> suggested you might be interested in the upFloat Partner Program.
    </p>

    <p style="margin:0 0 10px;font-size:15px;line-height:1.65;">
      <strong>What it is</strong><br>
      If you work with businesses that deal with MSME vendors, you can introduce them to MSME Tracker —
      the tool that collects Udyam declarations from vendors and produces a Section 43B(h) audit log.
      When a business you introduced takes a paid plan, you receive a referral incentive.
    </p>

    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;"><strong>How it works</strong></p>
    <ol style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.75;color:#334155;">
      <li>You sign up as a partner. It takes a minute and you do not need an upFloat account.</li>
      <li>You get your own referral link to share.</li>
      <li>Anyone who signs up through your link stays linked to you.</li>
      <li>Your referral incentive is a share of what they pay — 5% to 20%, depending on how many businesses you have introduced.</li>
    </ol>

    <p style="margin:0 0 26px;">
      <a href="${joinUrl}" style="color:#7c3aed;font-size:15px;font-weight:600;">See the Partner Program &rarr;</a>
    </p>

    <p style="margin:0;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
      You received this because ${p} (${esc(partnerEmail)}) invited you. If it is not relevant, you can ignore this email
      and you will not hear from us again. Questions? Reply to this email or write to ${SUPPORT_MAIL}.<br>
      upFloat Partner Program.
    </p>
  </div>
</body></html>`
}

function partnerInviteText(partnerName: string, partnerEmail: string, joinUrl: string): string {
  return `Hello,

${partnerName} suggested you might be interested in the upFloat Partner Program.

WHAT IT IS
If you work with businesses that deal with MSME vendors, you can introduce them to MSME Tracker - the tool that collects Udyam declarations from vendors and produces a Section 43B(h) audit log. When a business you introduced takes a paid plan, you receive a referral incentive.

HOW IT WORKS
1. You sign up as a partner. It takes a minute and you do not need an upFloat account.
2. You get your own referral link to share.
3. Anyone who signs up through your link stays linked to you.
4. Your referral incentive is a share of what they pay - 5% to 20%, depending on how many businesses you have introduced.

See the Partner Program: ${joinUrl}

---
You received this because ${partnerName} (${partnerEmail}) invited you. If it is not relevant, you can ignore this email and you will not hear from us again.
Questions? Reply to this email or write to ${SUPPORT_MAIL}.
upFloat Partner Program.`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { emails, invite_type } = body

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
  }
  if (emails.length > 20) {
    return NextResponse.json({ error: 'Max 20 emails per batch' }, { status: 400 })
  }
  if (!['msme', 'partner'].includes(invite_type)) {
    return NextResponse.json({ error: 'Invalid invite type' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: partner } = await admin
    .from('standalone_partners')
    .select('id, name, email, referral_code')
    .eq('user_id', user.id)
    .limit(1).maybeSingle()

  if (!partner) return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 })

  const msmeUrl = `${APP_URL}/msme-landing?ref=${partner.referral_code}`
  const joinUrl = `${APP_URL}/partners/join?ref=${partner.referral_code}`
  // Replies go to the partner who sent the invite — a real person the
  // recipient may know, which reads far better to both humans and filters.
  const replyTo = (partner as any).email || user.email || SUPPORT_MAIL

  let sent = 0; let failed = 0

  for (const email of emails) {
    const normalEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalEmail)) { failed++; continue }

    const isMsme  = invite_type === 'msme'
    const html    = isMsme
      ? msmeInviteHtml(partner.name, replyTo, msmeUrl)
      : partnerInviteHtml(partner.name, replyTo, joinUrl)
    const text    = isMsme
      ? msmeInviteText(partner.name, replyTo, msmeUrl)
      : partnerInviteText(partner.name, replyTo, joinUrl)
    // Plain, specific subjects — no money words, no emoji, no ALL CAPS.
    const subject = isMsme
      ? `${partner.name} suggested MSME Tracker for your vendor records`
      : `${partner.name} invited you to the upFloat Partner Program`

    try {
      const { error: emailErr } = await resend.emails.send({
        from: FROM, to: normalEmail, subject, html, text,
        replyTo,
        headers: INVITE_HEADERS,
      })
      if (emailErr) { failed++; continue }

      // Correctly track invite count: select first, then insert or increment
      const { data: existingInvite } = await admin
        .from('partner_portal_invites')
        .select('id, invite_count')
        .eq('partner_id', partner.id)
        .eq('email', normalEmail)
        .eq('invite_type', invite_type)
        .limit(1).maybeSingle()

      if (existingInvite) {
        await admin.from('partner_portal_invites')
          .update({ invite_count: existingInvite.invite_count + 1, last_sent_at: new Date().toISOString() })
          .eq('id', existingInvite.id)
      } else {
        await admin.from('partner_portal_invites').insert({
          partner_id:   partner.id,
          email:        normalEmail,
          invite_type,
          invite_count: 1,
          last_sent_at: new Date().toISOString(),
        })
      }

      sent++
    } catch { failed++ }
  }

  // Refresh invite list to return to client
  const { data: invites } = await admin
    .from('partner_portal_invites')
    .select('id, email, invite_type, invite_count, last_sent_at, signed_up')
    .eq('partner_id', partner.id)
    .eq('invite_type', invite_type)
    .order('last_sent_at', { ascending: false })

  return NextResponse.json({ sent, failed, invites: invites ?? [] })
}
