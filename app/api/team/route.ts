import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { assertCan }         from '@/lib/utils/permissionGate'
import { effectivePlan, isAtMemberLimit, memberLimit } from '@/lib/utils/planGate'
import { dbError } from '@/lib/api-error'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sng-adwisers.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const { data, error } = await supabase.from('org_members')
    .select('id, role, joined_at, user_id, can_view_all_tasks, users(id, name, email, avatar_url)')
    .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at')
  if (error) return NextResponse.json(dbError(error, 'team'), { status: 500 })
  return NextResponse.json({ data }, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const inviteDenied = await assertCan(supabase, mb.org_id, mb.role, 'team.invite')
  if (inviteDenied) return NextResponse.json({ error: inviteDenied.error }, { status: inviteDenied.status })

  const { email, role = 'member' } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (!['admin', 'manager', 'member', 'viewer'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const admin = createAdminClient()

  // Check member limit
  const { data: orgData } = await admin.from('organisations')
    .select('plan_tier, status, trial_ends_at').eq('id', mb.org_id).single()
  const { count: currentMembers } = await admin.from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', mb.org_id).eq('is_active', true)
  const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
  if (isAtMemberLimit(plan, currentMembers ?? 0)) {
    return NextResponse.json({
      error: `Your ${plan} plan allows up to ${memberLimit(plan)} members. Upgrade to add more.`
    }, { status: 403 })
  }

  // Check if user already exists in public.users
  const { data: existingUser } = await admin
    .from('users').select('id').eq('email', email.toLowerCase().trim()).maybeSingle()

  if (existingUser) {
    // User exists — check membership
    const { data: existing } = await admin.from('org_members')
      .select('id, is_active').eq('org_id', mb.org_id).eq('user_id', existingUser.id).maybeSingle()
    if (existing?.is_active)
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })

    // Deactivate any active memberships in OTHER orgs before activating in this one.
    // A user must belong to exactly one active org at a time — having multiple active rows
    // causes .single()/.maybeSingle() lookups to fail or return the wrong org, which is
    // the root cause of cross-org data leakage.
    await admin.from('org_members')
      .update({ is_active: false })
      .eq('user_id', existingUser.id)
      .neq('org_id', mb.org_id)
      .eq('is_active', true)

    if (existing) {
      await admin.from('org_members').update({ is_active: true, role }).eq('id', existing.id)
    } else {
      await admin.from('org_members').insert({ org_id: mb.org_id, user_id: existingUser.id, role, is_active: true })
    }
    return NextResponse.json({ success: true, message: 'Member added to your workspace' })
  }

  // New user — send Supabase invite email.
  // FIX: redirectTo points to /auth/confirm (handles implicit flow token in hash)
  // and includes the org/role so the callback can provision membership.
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    data: { invited_to_org: mb.org_id, invited_role: role },
    redirectTo: `${APP_URL}/auth/confirm`,
  })

  if (inviteErr) {
    console.error('[/api/team POST] inviteUserByEmail failed:', inviteErr.message)
    return NextResponse.json(dbError(inviteErr, 'team'), { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Invitation sent!' })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const body = await request.json()
  const { member_id, user_id, role, is_active, can_view_all_tasks } = body

  // Gate based on action type
  if (is_active === false) {
    const removeDenied = await assertCan(supabase, mb.org_id, mb.role, 'team.remove')
    if (removeDenied) return NextResponse.json({ error: removeDenied.error }, { status: removeDenied.status })
  } else {
    const changeRoleDenied = await assertCan(supabase, mb.org_id, mb.role, 'team.change_role')
    if (changeRoleDenied) return NextResponse.json({ error: changeRoleDenied.error }, { status: changeRoleDenied.status })
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const idToCheck = member_id || user_id
  if (!idToCheck || !UUID_RE.test(idToCheck))
    return NextResponse.json({ error: 'Valid member_id or user_id is required' }, { status: 400 })

  // ── Edit member info (name / phone) ───────────────────────────────────────
  if (body.name !== undefined || body.phone_number !== undefined) {
    if (!['owner', 'admin'].includes(mb.role))
      return NextResponse.json({ error: 'Only owners and admins can edit member info' }, { status: 403 })
    const { data: targetMember } = await admin.from('org_members')
      .select('role').eq('org_id', mb.org_id).eq('user_id', user_id).maybeSingle()
    if (!targetMember)
      return NextResponse.json({ error: 'Member not found in this organisation' }, { status: 404 })
    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.name?.trim()) update.name = body.name.trim()
    if (typeof body.phone_number !== 'undefined') update.phone_number = body.phone_number || null
    const { error: updateErr } = await admin.from('users').update(update).eq('id', user_id)
    if (updateErr) return NextResponse.json(dbError(updateErr, 'team'), { status: 500 })
    return NextResponse.json({ success: true })
  }

  const admin = createAdminClient()

  // ── Remove member (soft-deactivate) ──────────────────────────────────────
  if (is_active === false) {
    if (user_id === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    const { data: targetMember } = await admin.from('org_members')
      .select('role').eq('org_id', mb.org_id).eq('user_id', user_id).maybeSingle()
    if (targetMember?.role === 'owner')
      return NextResponse.json({ error: 'Cannot remove an owner' }, { status: 403 })
    let removeQuery = admin.from('org_members').update({ is_active: false }).eq('org_id', mb.org_id)
    if (member_id) removeQuery = removeQuery.eq('id', member_id)
    else           removeQuery = removeQuery.eq('user_id', user_id)
    const { error: removeErr } = await removeQuery
    if (removeErr) return NextResponse.json(dbError(removeErr, 'team'), { status: 500 })
    return NextResponse.json({ success: true, message: 'Member removed' })
  }

  // ── Toggle "View all tasks" permission ────────────────────────────────────
  // Only owners/admins can grant this; cannot apply to owners/admins (they always see all).
  if (typeof can_view_all_tasks === 'boolean') {
    if (!['owner', 'admin'].includes(mb.role))
      return NextResponse.json({ error: 'Only owners and admins can change this permission' }, { status: 403 })
    const { data: target } = await admin.from('org_members')
      .select('role').eq('org_id', mb.org_id).eq('id', member_id ?? '').maybeSingle()
    if (target && ['owner', 'admin'].includes(target.role))
      return NextResponse.json({ error: 'Cannot override permissions for owners or admins' }, { status: 400 })
    const { error: flagErr } = await admin.from('org_members')
      .update({ can_view_all_tasks }).eq('org_id', mb.org_id).eq('id', member_id)
    if (flagErr) return NextResponse.json(dbError(flagErr, 'team'), { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Change role ───────────────────────────────────────────────────────────
  if (!role || !['admin', 'manager', 'member', 'viewer'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  let query = admin.from('org_members').update({ role }).eq('org_id', mb.org_id)
  if (member_id) query = query.eq('id', member_id)
  else           query = query.eq('user_id', user_id)

  const { error } = await query
  if (error) return NextResponse.json(dbError(error, 'team'), { status: 500 })
  return NextResponse.json({ success: true })
}