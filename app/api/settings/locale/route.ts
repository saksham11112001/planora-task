import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { dbError }           from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { DEFAULT_COUNTRY, isValidCountry, getCountry } from '@/lib/locale/countries'

/** Detect country from Vercel/Cloudflare IP headers. Returns a supported country code. */
function detectCountryFromIp(request: NextRequest): string {
  // Vercel injects x-vercel-ip-country on all edge requests (ISO 3166-1 alpha-2)
  // Cloudflare injects cf-ipcountry on proxied requests
  const ipCountry =
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    ''
  return isValidCountry(ipCountry) ? ipCountry.toUpperCase() : DEFAULT_COUNTRY
}

/** GET — current org country/locale. Any member may read. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ data: { country: detectCountryFromIp(request) } })

    const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
    if (!mb) return NextResponse.json({ data: { country: detectCountryFromIp(request) } })

    const admin = createAdminClient()
    const { data } = await admin.from('org_settings')
      .select('locale').eq('org_id', mb.org_id).maybeSingle()

    const storedCountry = (data as any)?.locale?.country
    // Use stored preference; fall back to IP-detected country for new orgs
    const country = storedCountry ?? detectCountryFromIp(request)
    const profile = getCountry(country)
    return NextResponse.json({ data: { country: profile.code } })
  } catch {
    return NextResponse.json({ data: { country: DEFAULT_COUNTRY } })
  }
}

/** PATCH — set org country. Owner/admin only. */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { country } = await request.json()
  if (!isValidCountry(country))
    return NextResponse.json({ error: `Invalid country "${country}"` }, { status: 400 })

  const admin = createAdminClient()
  // Merge into existing locale object so future locale keys are preserved
  const { data: existing } = await admin.from('org_settings')
    .select('locale').eq('org_id', mb.org_id).maybeSingle()
  const locale = { ...(((existing as any)?.locale) ?? {}), country: country.toUpperCase() }

  const { error } = await admin.from('org_settings')
    .upsert({ org_id: mb.org_id, locale }, { onConflict: 'org_id' })

  if (error) return NextResponse.json(dbError(error, 'settings/locale'), { status: 500 })
  return NextResponse.json({ data: { country: country.toUpperCase() } })
}
