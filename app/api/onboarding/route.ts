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
    const { name, org_name, industry, team_size, phone, referral_code: rawReferralCode, how_did_you_hear, role_title, country, practice_type, years_in_practice, current_tool, pain_point } = body
    if (!org_name?.trim()) return NextResponse.json({ error: 'Organisation name required' }, { status: 400 })

    // ── Phone validation (required for org creators — identity anchor) ────────
    const cleanPhone = (phone as string | undefined)?.trim() || null
    if (!cleanPhone) {
      return NextResponse.json({ error: 'Phone number is required to create an organisation' }, { status: 400 })
    }
    // Basic E.164-style check: optional +, then 7–15 digits (spaces/dashes allowed)
    if (!/^\+?[\d\s\-().]{7,15}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'Please provide a valid phone number with country code' }, { status: 400 })
    }

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } } }
    )

    // ── Phone uniqueness: ensure this phone isn't already registered to another account ──
    const { data: existingPhoneUser } = await admin
      .from('users')
      .select('id')
      .eq('phone_number', cleanPhone)
      .neq('id', user.id)
      .maybeSingle()

    if (existingPhoneUser) {
      return NextResponse.json({ error: 'This phone number is already registered to another account. Each phone number can only be associated with one account.' }, { status: 409 })
    }

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

    // Guard: prevent creating a duplicate org with the same name for this user
    const { data: existingOrgs } = await admin
      .from('org_members')
      .select('organisations(name)')
      .eq('user_id', user.id)
      .eq('role', 'owner')
    const duplicate = (existingOrgs ?? []).some(
      (m: any) => (m.organisations?.name ?? '').trim().toLowerCase() === org_name.trim().toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json({ error: 'You already have an organisation with this name. Please choose a different name.' }, { status: 409 })
    }

    // Only the user's very first org gets a 14-day Pro trial.
    // Subsequent orgs start on free to prevent trial gaming.
    const { count: ownedOrgCount } = await admin
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'owner')
    const isFirstOrg = (ownedOrgCount ?? 0) === 0

    // ── One active trial per phone number ──────────────────────────────────────
    // If this is the user's first org (would be trialing), ensure no OTHER account
    // sharing this phone already owns a trialing org — prevents multi-account farming.
    if (isFirstOrg) {
      // Find any other user who has this phone and owns a trialing org
      const { data: samePhoneOwners } = await admin
        .from('org_members')
        .select('user_id, organisations!inner(status)')
        .eq('role', 'owner')
        .eq('organisations.status', 'trialing')

      if (samePhoneOwners) {
        const ownerIds = samePhoneOwners.map((m: any) => m.user_id).filter((id: string) => id !== user.id)
        if (ownerIds.length > 0) {
          const { data: phoneConflict } = await admin
            .from('users')
            .select('id')
            .in('id', ownerIds)
            .eq('phone_number', cleanPhone)
            .limit(1)
            .maybeSingle()
          if (phoneConflict) {
            return NextResponse.json({ error: 'A trial organisation is already active for this phone number. Only one trial is allowed per phone number.' }, { status: 409 })
          }
        }
      }
    }

    const now         = new Date()
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: org, error: orgErr } = await admin.from('organisations').insert({
      name: org_name.trim(), slug,
      plan_tier:            isFirstOrg ? 'pro'        : 'free',
      status:               isFirstOrg ? 'trialing'   : 'active',
      trial_started_at:     isFirstOrg ? now.toISOString() : null,
      trial_ends_at:        isFirstOrg ? trialEndsAt  : null,
      trial_extension_days: 0,
      referral_code: orgReferralCode,
      join_code: orgJoinCode,
      industry: industry || null, team_size: team_size || null,
      marketing_data: {
        how_did_you_hear:  how_did_you_hear  || null,
        role_title:        role_title        || null,
        country:           country           || null,
        practice_type:     practice_type     || null,
        years_in_practice: years_in_practice || null,
        current_tool:      current_tool      || null,
        pain_point:        pain_point        || null,
      },
    }).select('id').single()
    if (orgErr) return NextResponse.json(dbError(orgErr, 'onboarding'), { status: 500 })

    // ── Apply referral code — full anti-abuse validation ──────────────────────
    if (rawReferralCode) {
      const inputCode = normaliseCode(rawReferralCode)
      const { data: referrerOrg } = await admin
        .from('organisations')
        .select('id, trial_ends_at, trial_extension_days, status')
        .eq('referral_code', inputCode)
        .single()

      const MAX_EXTENSION_DAYS = 42
      const alreadyExtended    = referrerOrg?.trial_extension_days ?? 0
      const baseEligible =
        referrerOrg &&
        referrerOrg.id !== org.id &&
        referrerOrg.status === 'trialing' &&
        alreadyExtended < MAX_EXTENSION_DAYS

      if (baseEligible) {
        // Layer A: user-ID self-referral (same account in referrer org)
        const { data: userIdOverlap } = await admin
          .from('org_members')
          .select('id')
          .eq('org_id', referrerOrg.id)
          .eq('user_id', user.id)
          .maybeSingle()

        // Layer B: phone-based self-referral
        // Check if the calling user's phone matches any member of the referrer org
        let phoneInReferrer = false
        if (!userIdOverlap && cleanPhone) {
          const { data: referrerMemberIds } = await admin
            .from('org_members')
            .select('user_id')
            .eq('org_id', referrerOrg.id)
          const rids = (referrerMemberIds ?? []).map((m: any) => m.user_id)
          if (rids.length > 0) {
            const { data: phoneMatch } = await admin
              .from('users')
              .select('id')
              .in('id', rids)
              .eq('phone_number', cleanPhone)
              .limit(1)
              .maybeSingle()
            phoneInReferrer = !!phoneMatch
          }
        }

        // Layer C: circular ring (referrer has already redeemed from this new org — impossible
        // at signup since the org was just created, but guard for future-proofing)
        const { data: circularCheck } = await admin
          .from('referral_redemptions')
          .select('id')
          .eq('referrer_org_id', org.id)
          .eq('redeemer_org_id', referrerOrg.id)
          .maybeSingle()

        if (!userIdOverlap && !phoneInReferrer && !circularCheck) {
          const extensionDays = Math.min(7, MAX_EXTENSION_DAYS - alreadyExtended)
          const newTrialEnds  = new Date(
            Math.max(new Date(referrerOrg.trial_ends_at).getTime(), Date.now()) +
            extensionDays * 24 * 60 * 60 * 1000
          ).toISOString()

          await Promise.all([
            admin.from('organisations').update({
              trial_ends_at:        newTrialEnds,
              trial_extension_days: alreadyExtended + extensionDays,
            }).eq('id', referrerOrg.id),
            admin.from('referral_redemptions').insert({
              referrer_org_id:      referrerOrg.id,
              redeemer_org_id:      org.id,
              extension_days:       extensionDays,
              redeemer_owner_phone: cleanPhone,
            }),
          ])
        }
      }
    }

    // Add owner member
    await admin.from('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner', is_active: true })

    // Create default workspace
    await admin.from('workspaces').insert({ org_id: org.id, name: 'My workspace', color: '#0d9488', is_default: true, created_by: user.id })

    // Fire welcome email sequence (welcome now + day-2 follow-up via Inngest)
    try {
      const { inngest: inngestClient } = await import('@/lib/inngest/client')
      await inngestClient.send({
        name: 'user/welcome',
        data: {
          userId:    user.id,
          userEmail: user.email ?? '',
          userName:  resolvedName,
          orgName:   org_name.trim(),
          orgId:     org.id,
          trialDays: isFirstOrg ? 14 : 0,
        },
      })
    } catch (e) {
      // Non-fatal — don't fail org creation if Inngest is unavailable
      console.error('[onboarding] Failed to fire user/welcome event:', e)
    }

    return NextResponse.json({ success: true, org_id: org.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'onboarding'), { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
