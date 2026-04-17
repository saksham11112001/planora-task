import { createClient }    from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Verify user can access this task (org_id match + visibility rules)
  const canSeeAll = ['owner','admin','manager'].includes(mb.role) || mb.can_view_all_tasks
  const taskQ = supabase.from('tasks').select('id').eq('id', id).eq('org_id', mb.org_id)
  const taskFilter = canSeeAll ? taskQ : taskQ.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)
  const { data: taskAccess } = await taskFilter.maybeSingle()
  if (!taskAccess) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = req.nextUrl.searchParams
  const limit  = Math.min(parseInt(sp.get('limit') ?? '200', 10) || 200, 500)
  const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0,   0)
  const { data, error } = await supabase.from('task_attachments')
    .select('id, file_name, file_size, mime_type, storage_path, created_at, uploaded_by, uploader:users!task_attachments_uploaded_by_fkey(name)')
    .eq('task_id', id).eq('org_id', mb.org_id).order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Verify task exists in this org and user has access
  const canSeeAll = ['owner','admin','manager'].includes(mb.role) || mb.can_view_all_tasks
  const taskQ2 = supabase.from('tasks').select('id').eq('id', id).eq('org_id', mb.org_id)
  const taskFilter2 = canSeeAll ? taskQ2 : taskQ2.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)
  const { data: taskAccess2 } = await taskFilter2.maybeSingle()
  if (!taskAccess2) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    // Drive link / external URL attachment
    const body = await req.json()
    const { drive_url, file_name, attachment_type } = body
    if (!drive_url) return NextResponse.json({ error: 'drive_url required' }, { status: 400 })
    // Validate URL format and only allow http/https schemes
    try {
      const parsed = new URL(drive_url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ error: 'Only http/https URLs are allowed' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }
    const { data: row, error: dbErr } = await supabase.from('task_attachments').insert({
      task_id: id, org_id: mb.org_id, uploaded_by: user.id,
      file_name: file_name || drive_url,
      drive_url,
      attachment_type: attachment_type ?? 'link',
      file_size: 0,
      mime_type: 'text/uri-list',
      storage_path: '',
    }).select('*').single()
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json({ data: row }, { status: 201 })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: 'Max file size is 100 MB' }, { status: 400 })

  const ext         = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${mb.org_id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const bytes       = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage.from('attachments')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: row, error: dbErr } = await supabase.from('task_attachments').insert({
    task_id: id, org_id: mb.org_id, uploaded_by: user.id,
    file_name: file.name, file_size: file.size, mime_type: file.type, storage_path: storagePath,
  }).select('*').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: row }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const attId = req.nextUrl.searchParams.get('attachment_id')
  if (!attId) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: att } = await supabase.from('task_attachments').select('storage_path, uploaded_by, attachment_type, drive_url').eq('id', attId).eq('task_id', id).single()
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const canDel = att.uploaded_by === user.id || ['owner','admin','manager'].includes(mb.role)
  if (!canDel) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  // Only remove from storage for real file uploads (drive links have no storage_path)
  const isFileUpload = !att.drive_url && !att.attachment_type?.includes('link') && att.storage_path
  if (isFileUpload) {
    await supabase.storage.from('attachments').remove([att.storage_path])
  }
  await supabase.from('task_attachments').delete().eq('id', attId)
  return NextResponse.json({ ok: true })
}
