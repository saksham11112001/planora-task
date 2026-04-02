export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ data: {} })

    const { data: mb } = await supabase
      .from('org_members').select('org_id')
      .eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!mb) return NextResponse.json({ data: {} })

    const { data: rows, error } = await supabase
      .from('org_feature_settings')
      .select('feature_key, is_enabled')
      .eq('org_id', mb.org_id)

    if (error) {
      console.error('[features GET]', error.message)
      return NextResponse.json({ data: {} })
    }

    const features: Record<string, boolean> = {}
    for (const row of rows ?? []) {
      features[row.feature_key] = row.is_enabled
    }
    return NextResponse.json({ data: features })
  } catch (e: any) {
    console.error('[features GET crash]', e?.message)
    return NextResponse.json({ data: {} })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: mb } = await supabase
      .from('org_members').select('org_id, role')
      .eq('user_id', user.id).eq('is_active', true).maybeSingle()

    if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
    if (!['owner', 'admin'].includes(mb.role))
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const body = await request.json()
    const { feature_key, is_enabled } = body

    if (!feature_key) return NextResponse.json({ error: 'feature_key required' }, { status: 400 })

    // Use service role to bypass RLS entirely
    const { createClient: createSupabase } = await import('@supabase/supabase-js')
    const admin = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await admin
      .from('org_feature_settings')
      .upsert(
        { org_id: mb.org_id, feature_key, is_enabled: !!is_enabled },
        { onConflict: 'org_id,feature_key' }
      )

    if (error) {
      console.error('[features POST]', error.message, error.code)
      // If table doesn't exist, return the error clearly
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    return NextResponse.json({ success: true, feature_key, is_enabled })
  } catch (e: any) {
    console.error('[features POST crash]', e?.message)
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
