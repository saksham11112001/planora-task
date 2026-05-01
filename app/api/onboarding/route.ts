import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { generateCode, normaliseCode } from '@/lib/utils/codeGen'

export async function POST(request: NextRequest) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const { createClient } = await import('@/lib/supabase/server')

    const supabase      = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await request.json()
    const { name, org_name, industry, team_size, phone, referral_code: rawReferralCode } = body
    if (!org_name?.trim()) return NextResponse.json({ error: 'Organisation name required' }, { status: 400 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } } }
    )

    // Upsert user profile — prefer the name the user explicitly typed over OAuth metadata
    const resolvedName =
      (name as string | undefined)?.trim() ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (user.user_metadata?.given_name && user.user_metadata?.family_name
        ? `${user.user_metadata.given_name} ${user.user_metadata.family_name}`
        : null) ||
      user.user_metadata?.given_name ||
      user.email?.split('@')[0]?.replace(/[._]/g, ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase()) ||
      'User'
    await admin.from('users').upsert({
      id:                user.id,
      email:             user.email ?? '',
      name:              resolvedName,
      avatar_url:        user.user_metadata?.avatar_url ?? null,
      phone_number:      phone?.trim() || null,
      whatsapp_opted_in: !!(phone?.trim()),
    }, { onConflict: 'id' })

    // Generate unique slug
    const base = org_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = `${base}-${Date.now().toString(36)}`

    // Generate org codes
    const orgReferralCode = generateCode(8)
    const orgJoinCode     = generateCode(8)

    // Create org with 14-day pro trial
    const now         = new Date()
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: org, error: orgErr } = await admin.from('organisations').insert({
      name: org_name.trim(), slug, plan_tier: 'pro', status: 'trialing',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt,
      trial_extension_days: 0,
      referral_code: orgReferralCode,
      join_code: orgJoinCode,
      industry: industry || null, team_size: team_size || null,
    }).select('id').single()
    if (orgErr) return NextResponse.json(dbError(orgErr, 'onboarding'), { status: 500 })

    // Apply referral code if provided — extend referrer's trial by 7 days
    if (rawReferralCode) {
      const inputCode = normaliseCode(rawReferralCode)
      const { data: referrerOrg } = await admin
        .from('organisations')
        .select('id, trial_ends_at, trial_extension_days, status')
        .eq('referral_code', inputCode)
        .single()

      const MAX_EXTENSION_DAYS = 42
      const alreadyExtended    = referrerOrg?.trial_extension_days ?? 0
      const canExtend =
        referrerOrg &&
        referrerOrg.id !== org.id &&
        referrerOrg.status === 'trialing' &&
        alreadyExtended < MAX_EXTENSION_DAYS

      if (canExtend) {
        // Check no self-referral via shared members (same user is not in referrer org as member)
        const { data: overlap } = await admin
          .from('org_members')
          .select('id')
          .eq('org_id', referrerOrg.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!overlap) {
          const extensionDays      = Math.min(7, MAX_EXTENSION_DAYS - alreadyExtended)
          const newTrialEnds       = new Date(
            Math.max(new Date(referrerOrg.trial_ends_at).getTime(), Date.now()) +
            extensionDays * 24 * 60 * 60 * 1000
          ).toISOString()

          await Promise.all([
            admin.from('organisations').update({
              trial_ends_at:        newTrialEnds,
              trial_extension_days: alreadyExtended + extensionDays,
            }).eq('id', referrerOrg.id),
            admin.from('referral_redemptions').insert({
              referrer_org_id: referrerOrg.id,
              redeemer_org_id: org.id,
              extension_days:  extensionDays,
            }),
          ])
        }
      }
    }

    // Add owner member
    await admin.from('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner', is_active: true })

    // Create default workspace
    await admin.from('workspaces').insert({ org_id: org.id, name: 'My workspace', color: '#0d9488', is_default: true, created_by: user.id })

    return NextResponse.json({ success: true, org_id: org.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'onboarding'), { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
