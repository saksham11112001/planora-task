import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'

export const maxDuration = 30

/**
 * POST /api/ca/master/bulk
 *
 * Bulk-update multiple CA master tasks in a single authenticated request.
 * Auth is paid once; all DB writes fire in parallel via Promise.all.
 *
 * Body:
 *   rows — array of { id: string, ...fields } objects to update
 *
 * Returns:
 *   { saved: N, failed: M, errors: [...] }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json() as { rows?: Array<{ id: string; [key: string]: unknown }> }
  const { rows } = body
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'rows array required' }, { status: 400 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const results = await Promise.allSettled(
    rows.map(({ id, ...fields }) =>
      admin.from('ca_master_tasks')
        .update({ ...fields, updated_at: now })
        .eq('id', id)
        .eq('org_id', mb.org_id)
        .select('id')
        .single()
    )
  )

  const errors: { id: string; error: string }[] = []
  let saved = 0
  rows.forEach(({ id }, i) => {
    const r = results[i]
    if (r.status === 'fulfilled' && !r.value.error) {
      saved++
    } else {
      const err = r.status === 'rejected'
        ? String(r.reason)
        : (r.value.error?.message ?? 'Unknown error')
      errors.push({ id, error: err })
    }
  })

  return NextResponse.json({ saved, failed: errors.length, errors })
}
