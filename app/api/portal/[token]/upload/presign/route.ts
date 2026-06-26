// Presigned R2 PUT URL for client portal document uploads.
// The browser uploads directly to R2 — zero Vercel bandwidth for file bytes.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { R2_CONFIGURED, r2PresignedPutUrl } from '@/lib/storage/r2'
import crypto                        from 'crypto'

const MAX_SIZE = 20 * 1024 * 1024

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!R2_CONFIGURED) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 })
  }

  const { token: rawToken } = await params
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  const { data: tokenRow } = await admin
    .from('client_portal_tokens')
    .select('id, org_id, client_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { filename, content_type, size, document_type_id, period_key } = await req.json()
  if (!filename || !content_type || !period_key) {
    return NextResponse.json({ error: 'filename, content_type, period_key required' }, { status: 400 })
  }
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 400 })
  }

  const { org_id, client_id } = tokenRow
  const safeName    = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const typeSegment = document_type_id ?? 'direct'
  const key = `portal/${org_id}/${client_id}/${typeSegment}/${period_key}/${Date.now()}_${safeName}`

  const upload_url = await r2PresignedPutUrl(key, content_type || 'application/octet-stream', 300)
  return NextResponse.json({ upload_url, key }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
