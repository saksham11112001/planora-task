// One-shot settings bootstrap for useOrgSettings().
//
// The hook previously fired FIVE parallel API requests on first page load
// (custom-fields, fields, features, permissions, locale) — each paying its own
// middleware pass, auth check and org-membership lookup, mostly to read the
// SAME org_settings row. This endpoint returns all five payloads (identical
// shapes) from one auth + membership resolution and three parallel queries.
//
// The individual routes remain — their POST/PATCH handlers are still the write
// path, and other callers still use their GETs.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { getCountry, isValidCountry, DEFAULT_COUNTRY } from '@/lib/locale/countries'

function detectCountryFromIp(request: NextRequest): string {
  const ipCountry =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ?? ''
  return isValidCountry(ipCountry) ? ipCountry.toUpperCase() : DEFAULT_COUNTRY
}

// Anonymous/orgless fallback — mirrors what the five routes return individually.
function emptyPayload(country: string) {
  return {
    custom_fields: [] as unknown[],
    task_fields:   null,
    features:      {} as Record<string, boolean>,
    permissions:   null,
    locale:        { country },
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(supabase)
    if (!user) return NextResponse.json({ data: emptyPayload(detectCountryFromIp(request)) })

    const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
    if (!mb) return NextResponse.json({ data: emptyPayload(detectCountryFromIp(request)) })

    const admin = createAdminClient()
    const [{ data: s }, { data: featureRows }, { data: m }] = await Promise.all([
      admin.from('org_settings')
        .select('custom_task_fields, task_fields, role_permissions, locale')
        .eq('org_id', mb.org_id).maybeSingle(),
      admin.from('org_feature_settings')
        .select('feature_key, is_enabled')
        .eq('org_id', mb.org_id),
      admin.from('org_members')
        .select('permissions')
        .eq('org_id', mb.org_id).eq('user_id', user.id).maybeSingle(),
    ])

    const features: Record<string, boolean> = {}
    for (const row of featureRows ?? []) features[row.feature_key] = row.is_enabled

    const storedCountry = (s as any)?.locale?.country
    const country = getCountry(storedCountry ?? detectCountryFromIp(request)).code

    return NextResponse.json({
      data: {
        custom_fields: (s as any)?.custom_task_fields ?? [],
        task_fields:   (s as any)?.task_fields ?? null,
        features,
        permissions: {
          role_permissions: (s as any)?.role_permissions ?? null,
          user_permissions: (m as any)?.permissions ?? null,
        },
        locale: { country },
      },
    })
  } catch (e: any) {
    console.error('[settings/bootstrap]', e?.message)
    return NextResponse.json({ data: emptyPayload(DEFAULT_COUNTRY) })
  }
}
