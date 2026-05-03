'use client'
import { useEffect, useState, useRef } from 'react'
import { fmtDate } from '@/lib/utils/format'

interface DocType {
  id: string
  name: string
  category: string
  linked_task_types: string[]
}

interface ChecklistItem {
  header: string
  document_type_id: string | null
  uploaded: boolean
  upload: { id: string; file_name: string; uploaded_at: string; file_url: string } | null
}

interface UpcomingTask {
  instance_id: string
  task_id: string
  task_title: string
  task_status: string
  due_date: string
  collection_deadline: string
  month_key: string
  period_key: string
  docs_complete: boolean
  checklist: ChecklistItem[]
  uploaded_count: number
  total_count: number
  assignee_name: string | null
}

interface EverGreenUpload {
  id: string
  document_type_id: string
  period_key: string
  file_url: string
  file_name: string
  uploaded_at: string
  document_type: { id: string; name: string; category: string } | null
}

interface HistoryItem {
  instance_id: string
  task_id: string
  task_title: string
  due_date: string
  completed_at: string | null
  assignee_name: string | null
}

interface PortalData {
  org:      { id: string; name: string }
  client:   { id: string; name: string; color: string }
  upcoming: UpcomingTask[]
  evergreen: EverGreenUpload[]
  history:   HistoryItem[]
  doc_types: DocType[]
}

interface Props {
  rawToken: string
}

export function PortalView({ rawToken }: Props) {
  const [data, setData]       = useState<PortalData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    try {
      const res = await fetch(`/api/portal/${rawToken}`)
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to load portal')
      }
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <PortalShell orgName="Floatup" clientName=""><LoadingState /></PortalShell>
  if (error)   return <PortalShell orgName="Floatup" clientName=""><ErrorState message={error} /></PortalShell>
  if (!data)   return null

  return (
    <PortalShell orgName={data.org.name} clientName={data.client.name}>
      {/* Upcoming document deadlines */}
      <Section title="Upcoming Filing Deadlines" count={data.upcoming.length}>
        {data.upcoming.length === 0 ? (
          <EmptyCard text="No upcoming compliance tasks in the next 60 days." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.upcoming.map(task => (
              <TaskCard
                key={task.instance_id}
                task={task}
                rawToken={rawToken}
                onUploaded={fetchData}
                docTypes={data.doc_types}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Evergreen document vault */}
      <Section title="Permanent Documents" subtitle="Uploaded once, valid indefinitely">
        <EvergreenVault
          uploads={data.evergreen}
          docTypes={data.doc_types.filter(d => d.category === 'evergreen')}
          rawToken={rawToken}
          onUploaded={fetchData}
        />
      </Section>

      {/* Filing history */}
      {data.history.length > 0 && (
        <Section title="Filing History" subtitle="Completed in the last 6 months">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.history.map(h => (
              <div key={h.instance_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: '8px',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a' }}>{h.task_title}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Due {fmtDate(h.due_date)}{h.assignee_name ? ` · ${h.assignee_name}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: '12px', fontWeight: 600, color: '#16a34a',
                  background: 'rgba(22,163,74,0.1)', padding: '3px 10px', borderRadius: '20px',
                }}>✓ Filed</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </PortalShell>
  )
}

// ── Task card with checklist ────────────────────────────────────────────────

function TaskCard({ task, rawToken, onUploaded, docTypes }: {
  task: UpcomingTask
  rawToken: string
  onUploaded: () => void
  docTypes: DocType[]
}) {
  const daysUntilCollection = daysBetween(new Date().toISOString().split('T')[0], task.collection_deadline)
  const urgency = daysUntilCollection <= 0 ? '#dc2626' : daysUntilCollection <= 2 ? '#ea580c' : daysUntilCollection <= 7 ? '#ca8a04' : '#0d9488'

  return (
    <div style={{
      border: `1px solid #e2e8f0`,
      borderLeft: `4px solid ${urgency}`,
      borderRadius: '10px',
      background: '#fff',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{task.task_title}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '12px' }}>
            <span>📅 Filing deadline: <strong>{fmtDate(task.due_date)}</strong></span>
            <span style={{ color: urgency }}>⬆ Upload by: <strong>{fmtDate(task.collection_deadline)}</strong></span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {task.docs_complete ? (
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '3px 10px', borderRadius: '20px' }}>
              ✓ Docs complete
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {task.uploaded_count} / {task.total_count} uploaded
            </span>
          )}
        </div>
      </div>

      {task.checklist.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {task.checklist.map((item, i) => (
            <ChecklistRow
              key={i}
              item={item}
              taskId={task.task_id}
              periodKey={task.period_key}
              rawToken={rawToken}
              onUploaded={onUploaded}
              docTypes={docTypes}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Checklist row with upload ───────────────────────────────────────────────

function ChecklistRow({ item, taskId, periodKey, rawToken, onUploaded, docTypes }: {
  item: ChecklistItem
  taskId: string
  periodKey: string
  rawToken: string
  onUploaded: () => void
  docTypes: DocType[]
}) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr]             = useState<string | null>(null)
  const fileRef                   = useRef<HTMLInputElement>(null)

  // Resolve doc type id — may be null if org hasn't set up doc types yet (fallback path used)
  const docTypeId = item.document_type_id
    ?? docTypes.find(d => d.name.toLowerCase() === item.header.toLowerCase())?.id
    ?? null

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErr(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('period_key', periodKey)
      form.append('header_name', item.header)
      form.append('task_id', taskId)
      if (docTypeId) form.append('document_type_id', docTypeId)
      const res = await fetch(`/api/portal/${rawToken}/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onUploaded()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', background: item.uploaded ? 'rgba(22,163,74,0.05)' : '#fafafa',
      border: `1px solid ${item.uploaded ? 'rgba(22,163,74,0.2)' : '#e2e8f0'}`, borderRadius: '6px',
    }}>
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.uploaded ? '✅' : '⬜'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{item.header}</div>
        {item.upload && (
          <a href={item.upload.file_url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '11px', color: '#0d9488', textDecoration: 'none' }}>
            {item.upload.file_name} · {fmtDate(item.upload.uploaded_at)}
          </a>
        )}
        {err && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>{err}</div>}
      </div>
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />
      {!item.uploaded ? (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            fontSize: '12px', fontWeight: 600, color: '#fff',
            background: uploading ? '#94a3b8' : '#0d9488',
            border: 'none', borderRadius: '6px', padding: '6px 14px',
            cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}>
          {uploading ? 'Uploading…' : '+ Upload'}
        </button>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            fontSize: '11px', color: '#64748b', background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 10px',
            cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}>
          {uploading ? '…' : 'Replace'}
        </button>
      )}
    </div>
  )
}

// ── Evergreen vault ─────────────────────────────────────────────────────────

function EvergreenVault({ uploads, docTypes, rawToken, onUploaded }: {
  uploads: EverGreenUpload[]
  docTypes: DocType[]
  rawToken: string
  onUploaded: () => void
}) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const fileRefs                  = useRef<Record<string, HTMLInputElement | null>>({})

  const uploadMap = new Map(uploads.map(u => [u.document_type_id, u]))

  async function handleFile(dtId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(p => ({ ...p, [dtId]: true }))
    setErrors(p => ({ ...p, [dtId]: '' }))
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('document_type_id', dtId)
      form.append('period_key', 'evergreen')
      const res = await fetch(`/api/portal/${rawToken}/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onUploaded()
    } catch (e: any) {
      setErrors(p => ({ ...p, [dtId]: e.message }))
    } finally {
      setUploading(p => ({ ...p, [dtId]: false }))
      const ref = fileRefs.current[dtId]
      if (ref) ref.value = ''
    }
  }

  if (docTypes.length === 0 && uploads.length === 0) {
    return <EmptyCard text="No permanent documents required." />
  }

  // Show all doc types + any uploads that don't match a type
  const allTypes = docTypes.length > 0 ? docTypes : uploads.map(u => u.document_type).filter(Boolean) as DocType[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {allTypes.map(dt => {
        const existing = uploadMap.get(dt.id)
        const busy     = uploading[dt.id]
        return (
          <div key={dt.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px',
            background: existing ? 'rgba(22,163,74,0.05)' : '#fafafa',
            border: `1px solid ${existing ? 'rgba(22,163,74,0.2)' : '#e2e8f0'}`, borderRadius: '8px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>{existing ? '✅' : '📄'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{dt.name}</div>
              {existing ? (
                <a href={existing.file_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: '#0d9488', textDecoration: 'none' }}>
                  {existing.file_name} · Uploaded {fmtDate(existing.uploaded_at)}
                </a>
              ) : (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Not uploaded yet</div>
              )}
              {errors[dt.id] && <div style={{ fontSize: '11px', color: '#dc2626' }}>{errors[dt.id]}</div>}
            </div>
            <input
              type="file"
              style={{ display: 'none' }}
              ref={el => { fileRefs.current[dt.id] = el }}
              onChange={e => handleFile(dt.id, e)}
            />
            <button
              onClick={() => fileRefs.current[dt.id]?.click()}
              disabled={busy}
              style={{
                fontSize: '12px', fontWeight: 600,
                color: existing ? '#64748b' : '#fff',
                background: busy ? '#94a3b8' : existing ? 'none' : '#0d9488',
                border: existing ? '1px solid #e2e8f0' : 'none',
                borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', flexShrink: 0,
              }}>
              {busy ? 'Uploading…' : existing ? 'Replace' : '+ Upload'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Shell + helpers ─────────────────────────────────────────────────────────

function PortalShell({ orgName, clientName, children }: { orgName: string; clientName: string; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      colorScheme: 'light',
    }}>
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '16px 0' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>⚡ {orgName}</span>
          </div>
          {clientName && <span style={{ fontSize: '13px', color: '#94a3b8' }}>Client Portal · {clientName}</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 80px' }}>
        {children}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 20px', textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Powered by <strong>Floatup</strong></span>
      </div>
    </div>
  )
}

function Section({ title, subtitle, count, children }: { title: string; subtitle?: string; count?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'inline' }}>
          {title}
        </h2>
        {count !== undefined && (
          <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '8px' }}>({count})</span>
        )}
        {subtitle && <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>{text}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: '#64748b' }}>Loading your portal…</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: '#dc2626' }}>{message}</p>
    </div>
  )
}


function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24))
}
