import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ clientId: string }> }

// ── GET /api/clients/[clientId]/notes ─────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { clientId } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_notes')
    .select('*, users(id,name)')
    .eq('client_id', clientId)
    .eq('org_id', mb.org_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── POST /api/clients/[clientId]/notes ────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const { clientId } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { content, type } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_notes')
    .insert({
      org_id:    mb.org_id,
      client_id: clientId,
      user_id:   user.id,
      content:   content.trim(),
      type:      type || 'note',
    })
    .select('*, users(id,name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// ── DELETE /api/clients/[clientId]/notes?noteId=xxx ───────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const { clientId } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const noteId = req.nextUrl.searchParams.get('noteId')
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  const supabase = await createClient()
  // Only the author or managers can delete
  const isManager = ['owner','admin','manager'].includes(mb.role)
  let q = supabase.from('client_notes').delete()
    .eq('id', noteId).eq('client_id', clientId).eq('org_id', mb.org_id)
  if (!isManager) q = q.eq('user_id', user.id)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
