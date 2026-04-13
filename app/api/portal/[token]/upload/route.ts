import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import crypto                        from 'crypto'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

// POST /api/portal/[token]/upload
// Multipart form: file, document_type_id, period_key
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  // 1. Validate token
  const { data: tokenRow } = await admin
    .from('client_portal_tokens')
    .select('id, org_id, client_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { org_id, client_id } = tokenRow

  // 2. Parse form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file           = formData.get('file') as File | null
  const documentTypeId = formData.get('document_type_id') as string | null
  const periodKey      = formData.get('period_key') as string | null

  if (!file)           return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!documentTypeId) return NextResponse.json({ error: 'document_type_id is required' }, { status: 400 })
  if (!periodKey)      return NextResponse.json({ error: 'period_key is required' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 400 })

  // 3. Verify document_type belongs to this org
  const { data: docType } = await admin
    .from('client_document_types')
    .select('id, name, category, linked_task_types')
    .eq('id', documentTypeId)
    .eq('org_id', org_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!docType) return NextResponse.json({ error: 'Document type not found' }, { status: 404 })

  // 4. Upload file to Supabase Storage
  const fileBuffer  = Buffer.from(await file.arrayBuffer())
  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `portal/${org_id}/${client_id}/${documentTypeId}/${periodKey}/${Date.now()}_${safeName}`

  const { data: storageData, error: storageError } = await admin.storage
    .from('task-attachments')
    .upload(storagePath, fileBuffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (storageError) {
    console.error('[portal-upload] storage error:', storageError.message)
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage
    .from('task-attachments')
    .getPublicUrl(storageData.path)

  // 5. Upsert client_document_uploads (replace if same period_key + doc_type)
  await admin
    .from('client_document_uploads')
    .delete()
    .eq('client_id', client_id)
    .eq('document_type_id', documentTypeId)
    .eq('period_key', periodKey)

  const { data: upload, error: uploadError } = await admin
    .from('client_document_uploads')
    .insert({
      org_id,
      client_id,
      document_type_id: documentTypeId,
      period_key:        periodKey,
      file_url:          publicUrl,
      file_name:         file.name,
      file_size:         file.size,
      mime_type:         file.type,
    })
    .select('id')
    .single()

  if (uploadError || !upload) {
    console.error('[portal-upload] db insert error:', uploadError?.message)
    return NextResponse.json({ error: 'Failed to record upload' }, { status: 500 })
  }

  // 6. Auto-link to matching tasks
  await autoLinkToTasks({ admin, upload, docType, org_id, client_id, periodKey, publicUrl, fileName: file.name, fileSize: file.size, mimeType: file.type })

  return NextResponse.json({ success: true, upload_id: upload.id })
}

// ── Auto-link logic ─────────────────────────────────────────────────────────

async function autoLinkToTasks({
  admin, upload, docType, org_id, client_id, periodKey, publicUrl, fileName, fileSize, mimeType,
}: {
  admin: ReturnType<typeof createAdminClient>
  upload: { id: string }
  docType: { id: string; name: string; category: string; linked_task_types: string[] }
  org_id: string
  client_id: string
  periodKey: string
  publicUrl: string
  fileName: string
  fileSize: number
  mimeType: string
}) {
  // Evergreen docs link to all open tasks for this client
  const linkedTaskTypes: string[] = docType.linked_task_types ?? []
  if (linkedTaskTypes.length === 0) return

  // Resolve period to month_key + year if applicable
  // period_key: 'evergreen' | 'apr-2026' | 'q1-2026' | '2026'
  let monthKey: string | null = null
  let year:     string | null = null

  if (periodKey !== 'evergreen') {
    const parts = periodKey.split('-')
    if (parts.length === 2 && isNaN(Number(parts[0]))) {
      // monthly: 'apr-2026'
      monthKey = parts[0]
      year     = parts[1]
    } else if (parts.length === 2 && parts[0].startsWith('q')) {
      // quarterly: 'q1-2026' — link to all months in that quarter
      year = parts[1]
    } else if (parts.length === 1) {
      // annual
      year = parts[0]
    }
  }

  // Find matching ca_task_instances for this client
  let instanceQuery = admin
    .from('ca_task_instances')
    .select(`
      id, task_id, month_key, due_date,
      assignment:ca_client_assignments!ca_task_instances_assignment_id_fkey(
        master_task:ca_master_tasks!ca_client_assignments_master_task_id_fkey(
          name, task_types, attachment_headers
        )
      )
    `)
    .eq('org_id', org_id)

  if (year)     instanceQuery = instanceQuery.ilike('due_date', `${year}-%`)
  if (monthKey) instanceQuery = instanceQuery.eq('month_key', monthKey)

  const { data: instances } = await instanceQuery

  if (!instances?.length) return

  // Filter to instances for this client whose master task name is in linked_task_types
  const { data: clientAssignments } = await admin
    .from('ca_client_assignments')
    .select('id')
    .eq('client_id', client_id)
    .eq('org_id', org_id)
    .eq('is_active', true)

  const clientAssignmentIds = new Set((clientAssignments ?? []).map((a: any) => a.id))

  const matchingInstances = instances.filter((inst: any) => {
    if (!clientAssignmentIds.has(inst.assignment?.id ?? '')) {
      // The assignment id isn't on the instance directly, need to check via join
      return false
    }
    const masterName: string = inst.assignment?.master_task?.name ?? ''
    return linkedTaskTypes.some(t => t.toLowerCase() === masterName.toLowerCase())
  })

  // Re-query with assignment_id explicitly
  const { data: instances2 } = await admin
    .from('ca_task_instances')
    .select(`
      id, task_id, month_key, due_date, assignment_id,
      assignment:ca_client_assignments!ca_task_instances_assignment_id_fkey(
        id, client_id,
        master_task:ca_master_tasks!ca_client_assignments_master_task_id_fkey(
          name, task_types, attachment_headers
        )
      )
    `)
    .eq('org_id', org_id)
    .in('assignment_id', Array.from(clientAssignmentIds))

  const filtered = (instances2 ?? []).filter((inst: any) => {
    const masterName: string = inst.assignment?.master_task?.name ?? ''
    if (!linkedTaskTypes.some(t => t.toLowerCase() === masterName.toLowerCase())) return false
    if (periodKey === 'evergreen') return true
    if (year && !inst.due_date.startsWith(year)) return false
    if (monthKey && inst.month_key !== monthKey) return false
    return true
  })

  if (!filtered.length) return

  for (const inst of filtered) {
    const taskId = inst.task_id as string

    // Insert task_attachment
    const { data: attachment } = await admin
      .from('task_attachments')
      .insert({
        task_id:         taskId,
        org_id,
        file_url:        publicUrl,
        file_name:       fileName,
        file_size:       fileSize,
        mime_type:       mimeType,
        uploaded_by:     null,
        attachment_type: 'client_upload',
        drive_url:       null,
      })
      .select('id')
      .single()

    // Insert link (ignore if already exists)
    await admin
      .from('client_doc_task_links')
      .upsert({
        upload_id:     upload.id,
        task_id:       taskId,
        attachment_id: attachment?.id ?? null,
      }, { onConflict: 'upload_id,task_id', ignoreDuplicates: true })

    // Check if all attachment_headers for this task now have uploads
    const attachmentHeaders: string[] = inst.assignment?.master_task?.attachment_headers ?? []
    if (attachmentHeaders.length > 0) {
      await checkAndMarkDocsComplete({ admin, taskId, org_id, client_id, attachmentHeaders, year: year ?? '', monthKey })
    }
  }

  // Fire Inngest event to notify CA assignee
  try {
    const { inngest } = await import('@/lib/inngest/client')
    await inngest.send({
      name: 'client/document-uploaded',
      data: {
        org_id,
        client_id,
        upload_id:  upload.id,
        doc_type_name: docType.name,
        period_key: periodKey,
        task_ids:   filtered.map((i: any) => i.task_id),
      },
    })
  } catch (e) {
    console.error('[portal-upload] inngest send error:', e)
  }
}

async function checkAndMarkDocsComplete({
  admin, taskId, org_id, client_id, attachmentHeaders, year, monthKey,
}: {
  admin: ReturnType<typeof createAdminClient>
  taskId: string
  org_id: string
  client_id: string
  attachmentHeaders: string[]
  year: string
  monthKey: string | null
}) {
  // Get all doc types for this org by name
  const { data: docTypes } = await admin
    .from('client_document_types')
    .select('id, name')
    .eq('org_id', org_id)
    .eq('is_active', true)

  if (!docTypes?.length) return

  const dtByName = new Map(docTypes.map((d: any) => [d.name.toLowerCase(), d.id as string]))

  // For each attachment header, check if we have an upload for this client/period
  let allUploaded = true
  for (const header of attachmentHeaders) {
    const dtId = dtByName.get(header.toLowerCase())
    if (!dtId) { allUploaded = false; break }

    // Check for a period upload or evergreen
    const { data: uploads } = await admin
      .from('client_document_uploads')
      .select('id')
      .eq('client_id', client_id)
      .eq('document_type_id', dtId)
      .or(
        monthKey && year
          ? `period_key.eq.${monthKey}-${year},period_key.eq.evergreen`
          : `period_key.eq.evergreen${year ? `,period_key.eq.${year}` : ''}`
      )
      .limit(1)

    if (!uploads?.length) { allUploaded = false; break }
  }

  if (allUploaded) {
    // Mark task as docs complete
    await admin
      .from('tasks')
      .update({
        custom_fields: { _ca_compliance: true, _triggered: true, _docs_complete: true },
        // Optionally move to in_progress if still todo
        status: 'in_progress',
      })
      .eq('id', taskId)
      .eq('status', 'todo') // only advance if still at todo
  }
}
