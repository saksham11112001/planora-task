/**
 * GET /api/storage/signed-url?key=<r2-key>&expires=<seconds>&download=<filename>
 *
 * Returns a short-lived presigned R2 URL for a file the authenticated user's
 * org owns. Keys are structured as `{org_id}/{task_id}/...` so org ownership
 * is verified by prefix check — no extra DB round-trip required.
 *
 * Query params:
 *   key      – R2 object key (= storage_path from DB)  [required]
 *   expires  – URL lifetime in seconds, capped at 3600  [default 300]
 *   download – if present, adds Content-Disposition: attachment with this name
 */
import { NextRequest, NextResponse }          from 'next/server'
import { createClient }                       from '@/lib/supabase/server'
import { createAdminClient }                  from '@/lib/supabase/admin'
import { r2SignedUrl, R2_CONFIGURED }         from '@/lib/storage/r2'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const sp       = req.nextUrl.searchParams
  const key      = sp.get('key')
  const download = sp.get('download') ?? undefined
  const expires  = Math.min(Math.max(parseInt(sp.get('expires') ?? '300', 10) || 300, 30), 3600)

  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  // Verify key belongs to this user's org.
  // All task attachment keys are: `{org_id}/{task_id}/...`
  // Issue-report keys are: `issue-reports/...` (internal, any authenticated user is fine)
  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgPrefix = `${mb.org_id}/`
  if (!key.startsWith(orgPrefix) && !key.startsWith('issue-reports/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let url: string
  if (R2_CONFIGURED) {
    url = await r2SignedUrl(key, expires, download)
  } else {
    // Supabase Storage fallback — determine bucket from key prefix
    const admin = createAdminClient()
    const bucket = key.startsWith('issue-reports/') ? 'issue-reports' : 'attachments'
    const { data } = admin.storage.from(bucket).getPublicUrl(key)
    url = data.publicUrl
  }

  // Short cache — URL is already time-limited, no benefit caching at CDN
  return NextResponse.json({ url }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
