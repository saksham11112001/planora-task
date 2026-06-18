import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { resend, FROM }             from '@/lib/email/resend'
import { msmeInviteEmailHtml, msmeInviteEmailSubject } from '@/lib/email/templates/msmeInviteEmail'

const MSME_URL = process.env.NEXT_PUBLIC_MSME_URL ?? 'https://msme.upfloat.co'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owner/admin can view invites' }, { status: 403 })

  const admin = createAdminClient()
  const { data: invites } = await admin
    .from('partner_invites')
    .select('id, email, invite_count, last_sent_at, created_at')
    .eq('referrer_org_id', mb.org_id)
    .order('last_sent_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ invites: invites ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(id, name, referral_code), users(id, name)')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owner/admin can send invites' }, { status: 403 })

  const body = await req.json()
  const raw: string[] = Array.isArray(body.emails)
    ? body.emails
    : body.email ? [body.email] : []
  const emails = raw.map((e: string) => e.trim().toLowerCase()).filter(Boolean)

  if (emails.length === 0)
    return NextResponse.json({ error: 'At least one email address is required' }, { status: 400 })
  if (emails.length > 20)
    return NextResponse.json({ error: 'Maximum 20 emails per batch' }, { status: 400 })

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const invalid = emails.filter(e => !emailRe.test(e))
  if (invalid.length > 0)
    return NextResponse.json({ error: `Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}` }, { status: 400 })

  const admin      = createAdminClient()
  const org        = (mb.organisations as any)
  const senderUser = (mb as any).users as any

  // Get referral code (may need separate fetch if not in join)
  let refCode = org?.referral_code as string | null
  if (!refCode) {
    const { data: orgRow } = await admin.from('organisations').select('referral_code').eq('id', mb.org_id).maybeSingle()
    refCode = orgRow?.referral_code ?? null
  }

  const msmeUrl    = refCode ? `${MSME_URL}?ref=${refCode}` : MSME_URL
  const senderName = senderUser?.name ?? 'A colleague'
  const senderOrg  = org?.name ?? 'our team'

  let sent = 0; let failed = 0
  const results: Array<{ email: string; ok: boolean; error?: string }> = []

  // Pre-fetch existing invite records for this batch
  const { data: existing } = await admin
    .from('partner_invites')
    .select('email, invite_count')
    .eq('referrer_org_id', mb.org_id)
    .in('email', emails)
  const existingMap: Record<string, number> = {}
  for (const row of existing ?? []) existingMap[row.email] = row.invite_count ?? 1

  for (const email of emails) {
    try {
      const { error: emailErr } = await resend.emails.send({
        from: FROM,
        to:   email,
        subject: msmeInviteEmailSubject({ senderName, senderOrg, msmeUrl }),
        html:    msmeInviteEmailHtml({ senderName, senderOrg, msmeUrl }),
      })

      if (emailErr) {
        failed++
        results.push({ email, ok: false, error: emailErr.message })
        continue
      }

      const now   = new Date().toISOString()
      const count = (existingMap[email] ?? 0) + 1

      if (existingMap[email] !== undefined) {
        // Existing invite — increment count
        await admin.from('partner_invites')
          .update({ invite_count: count, last_sent_at: now })
          .eq('referrer_org_id', mb.org_id)
          .eq('email', email)
      } else {
        // First invite
        await admin.from('partner_invites')
          .insert({ referrer_org_id: mb.org_id, email, invite_count: 1, last_sent_at: now })
      }
      existingMap[email] = count

      sent++
      results.push({ email, ok: true })
    } catch (err: any) {
      failed++
      results.push({ email, ok: false, error: err.message ?? 'Unknown error' })
    }
  }

  return NextResponse.json({ sent, failed, results }, { status: sent > 0 ? 200 : 500 })
}
