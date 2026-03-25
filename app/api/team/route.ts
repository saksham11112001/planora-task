import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { resend, FROM }      from '@/lib/email/resend'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const { data, error } = await supabase.from('org_members')
    .select('id, role, joined_at, user_id, users(id, name, email, avatar_url)')
    .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role, organisations(name, plan_tier)')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can invite' }, { status: 403 })

  const { PLAN_LIMITS } = await import('@/lib/utils/plans')
  const planTier   = (mb.organisations as any)?.plan_tier ?? 'free'
  const orgName    = (mb.organisations as any)?.name ?? 'Your team'
  const maxMembers = PLAN_LIMITS[planTier as keyof typeof PLAN_LIMITS]?.members ?? 5
  if (maxMembers !== -1) {
    const { count } = await supabase
      .from('org_members').select('id', { count: 'exact', head: true })
      .eq('org_id', mb.org_id).eq('is_active', true)
    if ((count ?? 0) >= maxMembers)
      return NextResponse.json({
        error: `Member limit reached (${maxMembers} on your ${planTier} plan). Upgrade to add more.`,
      }, { status: 403 })
  }

  const { email, role = 'member' } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (!['admin','manager','member','viewer'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()
  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://planora.in'

  const { data: inviterProfile } = await admin.from('users').select('name').eq('id', user.id).single()
  const inviterName = inviterProfile?.name ?? user.email?.split('@')[0] ?? 'A team member'

  const { data: existingUser } = await admin.from('users').select('id').eq('email', normalizedEmail).maybeSingle()

  if (existingUser) {
    const { data: existing } = await admin.from('org_members')
      .select('id, is_active').eq('org_id', mb.org_id).eq('user_id', existingUser.id).maybeSingle()

    if (existing?.is_active) return NextResponse.json({ error: 'User is already a member' }, { status: 409 })

    if (existing) {
      await admin.from('org_members').update({ is_active: true, role }).eq('id', existing.id)
    } else {
      await admin.from('org_members').insert({ org_id: mb.org_id, user_id: existingUser.id, role, is_active: true })
    }

    // Notify existing user they were added
    try {
      await resend.emails.send({
        from: FROM,
        to: normalizedEmail,
        subject: `You've been added to ${orgName} on Planora`,
        html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f8fafc;padding:40px 16px;margin:0">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
<tr><td style="background:#0f172a;padding:20px 28px"><span style="color:#0d9488;font-weight:700;font-size:20px">Planora</span></td></tr>
<tr><td style="padding:28px">
  <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a">You've joined ${orgName}</h2>
  <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6"><strong>${inviterName}</strong> has added you to <strong>${orgName}</strong> as a <strong>${role}</strong>.</p>
  <a href="${appUrl}/dashboard" style="display:inline-block;background:#0d9488;color:#fff;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Planora →</a>
</td></tr></table></td></tr></table></body></html>`,
        text: `You've been added to ${orgName} on Planora by ${inviterName} as a ${role}.\n\nOpen the app: ${appUrl}/dashboard`,
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, message: 'Member added' })
  }

  // New user — Supabase sends invite email. Metadata is read in /auth/callback
  // to provision membership WITHOUT hitting /onboarding (which would make them owner).
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: {
      invited_to_org:  mb.org_id,
      invited_role:    role,
      invited_by_name: inviterName,
      org_name:        orgName,
    },
    redirectTo: `${appUrl}/auth/callback?invited=1`,
  })
  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 })

  return NextResponse.json({ success: true, message: 'Invitation sent' })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can change roles' }, { status: 403 })

  const { member_id, role } = await request.json()
  if (!['admin','manager','member','viewer'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const { error } = await supabase.from('org_members').update({ role }).eq('id', member_id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}