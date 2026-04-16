import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import crypto                        from 'crypto'

export const maxDuration = 30 // seconds — portal has multiple queries

// GET /api/portal/[token]
// Validates the token and returns client portal data.
// No auth required — token IS the auth.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params
  if (!rawToken) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  // 1. Validate token
  const { data: tokenRow } = await admin
    .from('client_portal_tokens')
    .select('id, org_id, client_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) return NextResponse.json({ error: 'Link not found or expired' }, { status: 404 })
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
  }

  const { org_id, client_id } = tokenRow

  // 2. Load org + client info in parallel
  const [{ data: org }, { data: client }] = await Promise.all([
    admin.from('organisations').select('id, name').eq('id', org_id).single(),
    admin.from('clients').select('id, name, color, email').eq('id', client_id).single(),
  ])

  if (!org || !client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 3. Load this client's active assignment IDs first (small, fast query)
  const now       = new Date()
  const cutoff    = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  const todayStr  = now.toISOString().split('T')[0]
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: clientAssignments } = await admin
    .from('ca_client_assignments')
    .select('id')
    .eq('client_id', client_id)
    .eq('org_id', org_id)
    .eq('is_active', true)

  const clientAssignmentIds = (clientAssignments ?? []).map((a: any) => a.id as string)

  // 4. Load upcoming compliance tasks filtered directly to this client's assignments.
  // Uses .in('assignment_id', [...]) so the DB does the filter — not JavaScript.
  // This replaces fetching ALL org instances then filtering in-memory.
  let upcoming: any[] = []
  if (clientAssignmentIds.length > 0) {
    const { data: upcomingInstances } = await admin
      .from('ca_task_instances')
      .select(`
        id, assignment_id, task_id, due_date, month_key, status,
        task:tasks!ca_task_instances_task_id_fkey(
          id, title, status, due_date, custom_fields,
          assignee:users!tasks_assignee_id_fkey(id, name)
        ),
        assignment:ca_client_assignments!ca_task_instances_assignment_id_fkey(
          id, master_task_id,
          master_task:ca_master_tasks!ca_client_assignments_master_task_id_fkey(
            id, name, attachment_headers, task_types
          )
        )
      `)
      .eq('org_id', org_id)
      .in('assignment_id', clientAssignmentIds)
      .gte('due_date', todayStr)
      .lte('due_date', cutoffStr)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(200)

    upcoming = (upcomingInstances ?? []).filter((inst: any) => inst.task?.status !== 'completed')
  }

  // 4. Load document uploads for this client
  const { data: uploads } = await admin
    .from('client_document_uploads')
    .select(`
      id, document_type_id, period_key, file_url, file_name, file_size, mime_type, uploaded_at,
      document_type:client_document_types!client_document_uploads_document_type_id_fkey(
        id, name, category
      )
    `)
    .eq('client_id', client_id)
    .eq('org_id', org_id)
    .order('uploaded_at', { ascending: false })

  // Build a lookup: period_key + doc_type_id → upload
  const uploadsByKey: Record<string, any> = {}
  ;(uploads ?? []).forEach((u: any) => {
    uploadsByKey[`${u.period_key}__${u.document_type_id}`] = u
  })

  // 5. Load document types for this org
  const { data: docTypes } = await admin
    .from('client_document_types')
    .select('id, name, category, linked_task_types, sort_order')
    .eq('org_id', org_id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // 6. Completed tasks (last 6 months) — filtered by client assignments in DB
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  let history: any[] = []
  if (clientAssignmentIds.length > 0) {
    const { data: historyInstances } = await admin
      .from('ca_task_instances')
      .select(`
        id, assignment_id, due_date, month_key,
        task:tasks!ca_task_instances_task_id_fkey(
          id, title, status, completed_at,
          assignee:users!tasks_assignee_id_fkey(id, name)
        )
      `)
      .eq('org_id', org_id)
      .in('assignment_id', clientAssignmentIds)
      .gte('due_date', sixMonthsAgo)
      .lt('due_date', todayStr)
      .order('due_date', { ascending: false })
      .limit(100)

    history = (historyInstances ?? []).filter((inst: any) => inst.task?.status === 'completed')
  }

  // 7. Evergreen uploads
  const evergreenUploads = (uploads ?? []).filter((u: any) => u.period_key === 'evergreen')

  // 8. Enrich upcoming tasks with document checklist
  const upcomingWithDocs = upcoming.map((inst: any) => {
    const dueDate          = inst.due_date as string
    const collectionDeadline = subtractDays(dueDate, 2)
    const master           = inst.assignment?.master_task
    const attachmentHeaders: string[] = master?.attachment_headers ?? []

    // Derive period_key for this task's month
    const monthPeriodKey = derivePeriodKey(inst.month_key, dueDate)

    const checklist = attachmentHeaders.map((header: string) => {
      // Find a doc type matching by name
      const dt = (docTypes ?? []).find((d: any) =>
        d.name.toLowerCase() === header.toLowerCase()
      )
      const upload = dt
        ? (uploadsByKey[`${monthPeriodKey}__${dt.id}`] ?? uploadsByKey[`evergreen__${dt.id}`])
        : null
      return {
        header,
        document_type_id: dt?.id ?? null,
        uploaded: !!upload,
        upload: upload ?? null,
      }
    })

    const uploadedCount = checklist.filter(c => c.uploaded).length

    return {
      instance_id:          inst.id,
      task_id:              inst.task?.id,
      task_title:           inst.task?.title ?? master?.name,
      task_status:          inst.task?.status,
      due_date:             dueDate,
      collection_deadline:  collectionDeadline,
      month_key:            inst.month_key,
      period_key:           monthPeriodKey,
      docs_complete:        inst.task?.custom_fields?._docs_complete === true,
      checklist,
      uploaded_count:       uploadedCount,
      total_count:          checklist.length,
      assignee_name:        inst.task?.assignee?.name ?? null,
    }
  })

  return NextResponse.json({
    org:    { id: org.id, name: org.name },
    client: { id: client.id, name: client.name, color: client.color },
    upcoming: upcomingWithDocs,
    evergreen: evergreenUploads,
    history: history.map((inst: any) => ({
      instance_id:  inst.id,
      task_id:      inst.task?.id,
      task_title:   inst.task?.title,
      due_date:     inst.due_date,
      completed_at: inst.task?.completed_at,
      assignee_name: inst.task?.assignee?.name ?? null,
    })),
    doc_types: docTypes ?? [],
  })
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// e.g. month_key='apr', due_date='2026-04-20' → 'apr-2026'
function derivePeriodKey(monthKey: string, dueDate: string): string {
  const year = dueDate.split('-')[0]
  return `${monthKey}-${year}`
}
