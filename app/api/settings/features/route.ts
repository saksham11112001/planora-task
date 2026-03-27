import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: {} })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: {} })

  const { data: rows } = await supabase
    .from('org_feature_settings')
    .select('feature_key, is_enabled, config')
    .eq('org_id', mb.org_id)

  // Convert rows to a flat object: { feature_key: is_enabled }
  const features: Record<string, boolean> = {}
  for (const row of rows ?? []) {
    features[row.feature_key] = row.is_enabled
  }
  return NextResponse.json({ data: features })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { feature_key, is_enabled } = await request.json()
  if (!feature_key) return NextResponse.json({ error: 'feature_key required' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('org_feature_settings').upsert(
    { org_id: mb.org_id, feature_key, is_enabled: !!is_enabled },
    { onConflict: 'org_id,feature_key' }
  )
  return NextResponse.json({ success: true })
}
