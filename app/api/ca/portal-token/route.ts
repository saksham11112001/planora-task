import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import crypto                        from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://planora.in'

// POST /api/ca/portal-token
// Body: { client_id: string }
// Returns: { token_url, expires_at }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })
  }

  const { client_id } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  // Verify the client belongs to this org
  const admin = createAdminClient()
  const { data: clientRow } = await admin
    .from('clients')
    .select('id')
    .eq('id', client_id)
    .eq('org_id', mb.org_id)
    .maybeSingle()
  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Generate raw token and hash
  const rawToken  = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  // Upsert: delete old token for this client then insert fresh one
  await admin
    .from('client_portal_tokens')
    .delete()
    .eq('org_id', mb.org_id)
    .eq('client_id', client_id)

  const portalUrl = `${APP_URL}/portal/${rawToken}`

  const { error } = await admin.from('client_portal_tokens').insert({
    org_id:     mb.org_id,
    client_id,
    token_hash: tokenHash,
    portal_url: portalUrl,
    expires_at: expiresAt,
    created_by: user.id,
  })
  if (error) {
    console.error('[portal-token] insert error:', error.message)
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })
  }

  return NextResponse.json({
    token_url:  `${APP_URL}/portal/${rawToken}`,
    expires_at: expiresAt,
  })
}

// DELETE /api/ca/portal-token
// Body: { client_id: string }
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })
  }

  const { client_id } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('client_portal_tokens')
    .delete()
    .eq('org_id', mb.org_id)
    .eq('client_id', client_id)

  if (error) {
    console.error('[portal-token] delete error:', error.message)
    return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// GET /api/ca/portal-token?client_id=xxx
// Returns token metadata (no raw token) for the CA team UI
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const client_id = req.nextUrl.searchParams.get('client_id')
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: token } = await admin
    .from('client_portal_tokens')
    .select('id, expires_at, created_at, created_by')
    .eq('org_id', mb.org_id)
    .eq('client_id', client_id)
    .maybeSingle()

  if (!token) return NextResponse.json({ token: null })

  const isExpired = new Date(token.expires_at) < new Date()
  return NextResponse.json({ token: { ...token, is_expired: isExpired } })
}
