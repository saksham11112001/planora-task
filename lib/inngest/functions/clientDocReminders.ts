import { inngest }                                from '../client'
import { createAdminClient }                      from '@/lib/supabase/admin'
import { sendBatchedClientDocReminderEmail }      from '@/lib/email/send'
import { sendClientDocReminderEmail }             from '@/lib/email/send'
import { sendClientUploadNotifyEmail }            from '@/lib/email/send'
import { fmtDate }                                from '@/lib/utils/format'
import { getOrgNotifMode, queueNotification }     from '@/lib/email/queue'
import type { BatchTaskEntry }                    from '@/lib/email/templates/clientDocReminder'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taska.in'

/**
 * Fires daily at 7:00 AM IST (1:30 AM UTC).
 *
 * For each active ca_task_instance that is not completed:
 *  1. Computes collection_deadline = due_date − 2 days
 *  2. Days until deadline:
 *     - 7  → email client "Upload needed"
 *     - 2  → email client "Deadline approaching"
 *     - 0  → email client + CA assignee "Today is the deadline"
 *     - -1 → email CA assignee only "Deadline passed, docs missing"
 *
 * Emails to the same recipient (client or CA) are BATCHED into one email
 * per day to avoid spam and stay within Resend's daily quota.
 *
 * Also handles 'client/document-uploaded' event → email CA assignee immediately.
 */
export const clientDocReminders = inngest.createFunction(
  {
    id:   'client-doc-reminders',
    name: 'Daily: client document collection reminders',
    concurrency: { limit: 1 },
  },
  [
    { cron: '30 1 * * *' },
    { event: 'client/document-uploaded' },
  ],
  async ({ event, step }) => {
    // ── Branch: upload notification event ───────────────────────────────────
    if (event.name === 'client/document-uploaded') {
      return await step.run('notify-ca-on-upload', async () => {
        const { org_id, client_id, doc_type_name, period_key, task_ids, upload_id } = event.data as any
        const admin = createAdminClient()

        const { data: org }    = await admin.from('organisations').select('name').eq('id', org_id).maybeSingle()
        const { data: client } = await admin.from('clients').select('name').eq('id', client_id).maybeSingle()
        const { data: upload } = await admin.from('client_document_uploads').select('file_name').eq('id', upload_id).maybeSingle()

        if (!org || !client) return { skipped: true }

        for (const taskId of (task_ids ?? [])) {
          const { data: task } = await admin
            .from('tasks')
            .select('id, title, assignee_id, assignee:users!tasks_assignee_id_fkey(id, email, name)')
            .eq('id', taskId)
            .maybeSingle()

          const assignee = (task as any)?.assignee
          if (!assignee?.email) continue

          await sendClientUploadNotifyEmail({
            to:           assignee.email,
            assigneeName: assignee.name ?? 'Team',
            clientName:   client.name,
            orgName:      org.name,
            taskTitle:    task?.title ?? 'Compliance task',
            docTypeName:  doc_type_name,
            periodKey:    period_key,
            fileName:     upload?.file_name ?? 'document',
            taskId,
          })
        }
        return { notified: task_ids?.length ?? 0 }
      })
    }

    // ── Branch: daily reminder cron ─────────────────────────────────────────
    const admin = createAdminClient()

    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const today  = nowIST.toISOString().split('T')[0]

    // Fetch all non-completed ca_task_instances with task + assignment data
    const instances = await step.run('fetch-active-instances', async () => {
      const { data, error } = await admin
        .from('ca_task_instances')
        .select(`
          id, org_id, assignment_id, task_id, due_date, month_key,
          task:tasks!ca_task_instances_task_id_fkey(
            id, title, status, custom_fields, assignee_id,
            assignee:users!tasks_assignee_id_fkey(id, email, name)
          ),
          assignment:ca_client_assignments!ca_task_instances_assignment_id_fkey(
            id, client_id,
            master_task:ca_master_tasks!ca_client_assignments_master_task_id_fkey(
              id, name, attachment_headers
            )
          )
        `)
        .not('task.status', 'eq', 'completed')
        .not('task', 'is', null)
      if (error) console.error('[clientDocReminders] fetch error:', error.message)
      return data ?? []
    })

    // Fetch clients (need email)
    const clientIds = [...new Set(instances.map((i: any) => i.assignment?.client_id).filter(Boolean))]
    const clients: Record<string, { name: string; email: string | null }> = {}
    if (clientIds.length) {
      const { data: clientRows } = await admin
        .from('clients')
        .select('id, name, email')
        .in('id', clientIds)
      ;(clientRows ?? []).forEach((c: any) => { clients[c.id] = c })
    }

    // Fetch org names
    const orgIds = [...new Set(instances.map((i: any) => i.org_id).filter(Boolean))]
    const orgs: Record<string, string> = {}
    if (orgIds.length) {
      const { data: orgRows } = await admin
        .from('organisations')
        .select('id, name')
        .in('id', orgIds)
      ;(orgRows ?? []).forEach((o: any) => { orgs[o.id] = o.name })
    }

    // Fetch document uploads for relevant clients to check missing docs
    const uploadsByClient: Record<string, Array<{ document_type_id: string; period_key: string }>> = {}
    if (clientIds.length) {
      const { data: uploadRows } = await admin
        .from('client_document_uploads')
        .select('client_id, document_type_id, period_key')
        .in('client_id', clientIds)
      ;(uploadRows ?? []).forEach((u: any) => {
        if (!uploadsByClient[u.client_id]) uploadsByClient[u.client_id] = []
        uploadsByClient[u.client_id].push(u)
      })
    }

    // Fetch doc types by org
    const docTypesByOrg: Record<string, Array<{ id: string; name: string }>> = {}
    if (orgIds.length) {
      const { data: dtRows } = await admin
        .from('client_document_types')
        .select('id, org_id, name')
        .in('org_id', orgIds)
        .eq('is_active', true)
      ;(dtRows ?? []).forEach((d: any) => {
        if (!docTypesByOrg[d.org_id]) docTypesByOrg[d.org_id] = []
        docTypesByOrg[d.org_id].push(d)
      })
    }

    // ── Build reminder buckets (group BEFORE sending) ────────────────────────
    // Key: `${clientEmail}::${orgId}` → all task entries to include in one email
    type ClientBucket = {
      email:     string
      name:      string
      orgName:   string
      portalUrl: string
      tasks:     BatchTaskEntry[]
    }

    type AssigneeBucket = {
      email:     string
      orgName:   string
      entries:   Array<{ clientName: string } & BatchTaskEntry & { portalUrl: string }>
    }

    const clientBuckets  = new Map<string, ClientBucket>()
    const assigneeBuckets = new Map<string, AssigneeBucket>()

    for (const inst of instances) {
      const task     = (inst as any).task
      const asgn     = (inst as any).assignment
      const clientId = asgn?.client_id
      if (!task || !clientId) continue

      if (task.custom_fields?._docs_complete) continue

      const dueDate            = inst.due_date as string
      const collectionDeadline = subtractDays(dueDate, 2)
      const daysLeft           = daysBetween(today, collectionDeadline)

      // Only fire on the specific days: 7, 2, 0, -1
      if (![7, 2, 0, -1].includes(daysLeft)) continue

      const client  = clients[clientId]
      const orgName = orgs[inst.org_id] ?? 'Floatup'
      if (!client) continue

      // Determine missing docs
      const attachmentHeaders: string[] = asgn?.master_task?.attachment_headers ?? []
      const monthKey  = inst.month_key as string
      const year      = dueDate.split('-')[0]
      const periodKey = `${monthKey}-${year}`
      const clientUploads = uploadsByClient[clientId] ?? []
      const orgDocTypes   = docTypesByOrg[inst.org_id] ?? []
      const dtByName      = new Map(orgDocTypes.map(d => [d.name.toLowerCase(), d.id]))

      const missingDocs = attachmentHeaders.filter(header => {
        const dtId = dtByName.get(header.toLowerCase())
        if (!dtId) return true
        return !clientUploads.some(u =>
          u.document_type_id === dtId &&
          (u.period_key === periodKey || u.period_key === 'evergreen')
        )
      })

      if (missingDocs.length === 0) continue

      const { data: tokenRow } = await admin
        .from('client_portal_tokens')
        .select('portal_url, expires_at')
        .eq('client_id', clientId)
        .maybeSingle()

      const portalUrl = (tokenRow?.portal_url && new Date(tokenRow.expires_at) > new Date())
        ? tokenRow.portal_url
        : APP_URL

      const taskEntry: BatchTaskEntry = {
        taskTitle:          task.title ?? asgn?.master_task?.name,
        dueDate:            fmtDate(dueDate),
        collectionDeadline: fmtDate(collectionDeadline),
        daysLeft,
        missingDocs,
      }

      // ── Client bucket (days 7, 2, 0 only) ────────────────────────────────
      if (daysLeft >= 0 && client.email) {
        const bucketKey = `${client.email}::${inst.org_id}`
        if (!clientBuckets.has(bucketKey)) {
          clientBuckets.set(bucketKey, {
            email:     client.email,
            name:      client.name,
            orgName,
            portalUrl,
            tasks:     [],
          })
        }
        clientBuckets.get(bucketKey)!.tasks.push(taskEntry)
      }

      // ── Assignee bucket (days 0 and -1) ──────────────────────────────────
      if (daysLeft <= 0) {
        const assignee = task.assignee
        if (assignee?.email) {
          const bucketKey = `${assignee.email}::${inst.org_id}`
          if (!assigneeBuckets.has(bucketKey)) {
            assigneeBuckets.set(bucketKey, {
              email:   assignee.email,
              orgName,
              entries: [],
            })
          }
          assigneeBuckets.get(bucketKey)!.entries.push({
            ...taskEntry,
            clientName: client.name,
            portalUrl: `${APP_URL}/compliance`,
          })
        }
      }
    }

    // ── Send one batched email per client ────────────────────────────────────
    let remindersClient   = 0
    let remindersAssignee = 0

    for (const [bucketKey, bucket] of clientBuckets) {
      if (bucket.tasks.length === 0) continue
      await step.run(`remind-client-${bucketKey}`, async () => {
        if (bucket.tasks.length === 1) {
          // Single task — use the original single-task email (more personal)
          const t = bucket.tasks[0]
          await sendClientDocReminderEmail({
            to:                 bucket.email,
            clientName:         bucket.name,
            orgName:            bucket.orgName,
            taskTitle:          t.taskTitle,
            dueDate:            t.dueDate,
            collectionDeadline: t.collectionDeadline,
            daysLeft:           t.daysLeft,
            portalUrl:          bucket.portalUrl,
            missingDocs:        t.missingDocs,
          })
        } else {
          // Multiple tasks — send one batched email
          await sendBatchedClientDocReminderEmail({
            to:         bucket.email,
            clientName: bucket.name,
            orgName:    bucket.orgName,
            portalUrl:  bucket.portalUrl,
            tasks:      bucket.tasks,
          })
        }
        remindersClient++
      })
    }

    // ── Queue assignee notifications into 2x/day digest ─────────────────────
    for (const [bucketKey, bucket] of assigneeBuckets) {
      if (bucket.entries.length === 0) continue
      await step.run(`queue-assignee-${bucketKey}`, async () => {
        const [email, orgId] = bucketKey.split('::')

        // Look up the assignee's user_id (needed for the queue row)
        const { data: userRow } = await admin
          .from('users').select('id').eq('email', email).maybeSingle()
        if (!userRow?.id) return

        const orgMode = await getOrgNotifMode(orgId)

        if (orgMode === 'digest') {
          // One digest entry per assignee summarising all affected clients
          const subject = bucket.entries.length === 1
            ? `Missing docs: ${bucket.entries[0].clientName} — ${bucket.entries[0].taskTitle} (deadline ${bucket.entries[0].daysLeft === 0 ? 'today' : 'passed'})`
            : `${bucket.entries.length} clients have documents missing (deadline today or passed)`

          await queueNotification({
            orgId,
            userId:    userRow.id,
            userEmail: email,
            eventType: 'client_docs_missing',
            subject,
          })
        } else {
          // Immediate mode — send email directly (same batched logic as before)
          if (bucket.entries.length === 1) {
            const e = bucket.entries[0]
            await sendClientDocReminderEmail({
              to:                 bucket.email,
              clientName:         e.clientName,
              orgName:            bucket.orgName,
              taskTitle:          e.taskTitle,
              dueDate:            e.dueDate,
              collectionDeadline: e.collectionDeadline,
              daysLeft:           e.daysLeft,
              portalUrl:          e.portalUrl,
              missingDocs:        e.missingDocs,
            })
          } else {
            await sendBatchedClientDocReminderEmail({
              to:         bucket.email,
              clientName: `${bucket.entries.length} client documents`,
              orgName:    bucket.orgName,
              portalUrl:  `${APP_URL}/compliance`,
              tasks:      bucket.entries,
            })
          }
        }
        remindersAssignee++
      })
    }

    return {
      date_checked:       today,
      reminders_client:   remindersClient,
      reminders_assignee: remindersAssignee,
    }
  }
)

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
}
