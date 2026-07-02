import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ data: null })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
  if (!mb) return NextResponse.json({ data: null })
  const admin = createAdminClient()
  const { data: s } = await admin.from('org_settings').select('task_fields').eq('org_id', mb.org_id).maybeSingle()
  return NextResponse.json({ data: s?.task_fields ?? null })
}
