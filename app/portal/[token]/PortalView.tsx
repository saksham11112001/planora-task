'use client'
import { useEffect, useState, useRef } from 'react'
import { fmtDate } from '@/lib/utils/format'
import PortalTour from './PortalTour'

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

type Tab = 'about' | 'deadlines' | 'documents' | 'history'

const ACCENT = '#0d9488'
const DARK   = '#0f172a'
const MUTED  = '#64748b'

export function PortalView({ rawToken }: Props) {
  const [data, setData]       = useState<PortalData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTour, setShowTour] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('about')

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

  if (loading) return <PortalShell orgName="upFloat" clientName="" activeTab="about" onTabChange={() => {}}><LoadingState /></PortalShell>
  if (error)   return <PortalShell orgName="upFloat" clientName="" activeTab="about" onTabChange={() => {}}><ErrorState message={error} /></PortalShell>
  if (!data)   return null

  const pendingCount = data.upcoming.filter(t => !t.docs_complete).length

  return (
    <PortalShell
      orgName={data.org.name}
      clientName={data.client.name}
      onTour={() => setShowTour(true)}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pendingCount={pendingCount}
    >
      {showTour && <PortalTour onDone={() => setShowTour(false)} />}

      {activeTab === 'about' && (
        <AboutPage orgName={data.org.name} clientName={data.client.name} />
      )}

      {activeTab === 'deadlines' && (
        <div data-tour="portal-deadlines">
          <SectionHeader
            title="Upcoming Filing Deadlines"
            subtitle="Documents your CA needs from you for upcoming compliance tasks"
          />
          {data.upcoming.length === 0 ? (
            <EmptyCard text="No upcoming compliance tasks in the next 60 days." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.upcoming.map((task, i) => (
                <TaskCard
                  key={task.instance_id}
                  task={task}
                  rawToken={rawToken}
                  onUploaded={fetchData}
                  docTypes={data.doc_types}
                  dataTour={i === 0 ? 'portal-task-card' : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div data-tour="portal-permanent">
          <SectionHeader
            title="Permanent Documents"
            subtitle="Uploaded once, valid indefinitely — PAN, Aadhaar, registration certificates, etc."
          />
          <EvergreenVault
            uploads={data.evergreen}
            docTypes={data.doc_types.filter(d => d.category === 'evergreen')}
            rawToken={rawToken}
            onUploaded={fetchData}
          />
        </div>
      )}

      {activeTab === 'history' && (
        <div data-tour="portal-history">
          <SectionHeader
            title="Filing History"
            subtitle="Completed filings in the last 6 months"
          />
          {data.history.length === 0 ? (
            <EmptyCard text="No completed filings yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.history.map(h => (
                <div key={h.instance_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: '#fff',
                  border: '1px solid #e2e8f0', borderRadius: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: DARK }}>{h.task_title}</div>
                    <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>
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
          )}
        </div>
      )}
    </PortalShell>
  )
}

// ── About / Welcome page ────────────────────────────────────────────────────

function AboutPage({ orgName, clientName }: { orgName: string; clientName: string }) {
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${DARK} 0%, #1e293b 60%, #134e4a 100%)`,
        borderRadius: '16px',
        padding: '36px 32px',
        marginBottom: '28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative rings */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', border: '2px solid rgba(13,148,136,0.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -10, right: -10, width: 120, height: 120, borderRadius: '50%', border: '2px solid rgba(13,148,136,0.15)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 160, height: 160, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(13,148,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              🤝
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Partners Program
            </span>
          </div>

          <h1 style={{ margin: '0 0 10px', fontSize: '26px', fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
            Welcome to MSME Compliance
          </h1>
          {clientName && (
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#94a3b8' }}>
              {clientName} · Powered by {orgName}
            </p>
          )}
          <p style={{ margin: 0, fontSize: '15px', color: '#cbd5e1', lineHeight: 1.7, maxWidth: 520 }}>
            We are here to help you stay fully compliant — not just for commissions.
            Your CA firm genuinely cares about your business health and long-term success.
          </p>
        </div>
      </div>

      {/* Value proposition */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { icon: '👥', title: 'Help Your Customers', body: 'When you are compliant, you can serve your own customers better — faster payments, more trust, and smoother contracts.' },
          { icon: '🤝', title: 'Help Your Clients', body: 'Your CA firm takes care of the filings so you can focus on what you do best — running your business.' },
          { icon: '🛡️', title: 'We Are Here to Help', body: 'Every upload, every deadline, every filing — we are with you, not just at tax season. Real partnership, real support.' },
        ].map(card => (
          <div key={card.title} style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{card.icon}</div>
            <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: DARK }}>{card.title}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>{card.body}</p>
          </div>
        ))}
      </div>

      {/* MSME Categories */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: DARK }}>MSME Categories</h2>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: MUTED }}>
          Under the MSMED Act, enterprises are classified based on investment and turnover:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Micro', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', invest: '≤ ₹1 Cr', turnover: '≤ ₹5 Cr', icon: '🌱' },
            { label: 'Small', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', invest: '≤ ₹10 Cr', turnover: '≤ ₹50 Cr', icon: '🏭' },
            { label: 'Medium', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', invest: '≤ ₹50 Cr', turnover: '≤ ₹250 Cr', icon: '🏢' },
          ].map(cat => (
            <div key={cat.label} style={{
              background: cat.bg,
              border: `1px solid ${cat.color}30`,
              borderRadius: '10px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '22px', marginBottom: '6px' }}>{cat.icon}</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: cat.color, marginBottom: '8px' }}>{cat.label}</div>
              <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.7 }}>
                <div>Investment: <strong>{cat.invest}</strong></div>
                <div>Turnover: <strong>{cat.turnover}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How this portal works */}
      <div style={{ background: `rgba(13,148,136,0.04)`, border: `1px solid rgba(13,148,136,0.15)`, borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: DARK }}>How This Portal Works</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { n: '1', title: 'Check Deadlines', body: 'See all upcoming compliance filings and what documents are needed.' },
            { n: '2', title: 'Upload Documents', body: 'Click "+ Upload" next to each item. Your CA is notified instantly.' },
            { n: '3', title: 'Store Permanent Docs', body: 'PAN, Aadhaar, GST certificate — upload once, reuse forever.' },
            { n: '4', title: 'Track History', body: 'See everything that has been filed on your behalf in the last 6 months.' },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: ACCENT, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0, marginTop: 1,
              }}>{step.n}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: DARK }}>{step.title}</div>
                <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Task card with checklist ────────────────────────────────────────────────

function TaskCard({ task, rawToken, onUploaded, docTypes, dataTour }: {
  task: UpcomingTask
  rawToken: string
  onUploaded: () => void
  docTypes: DocType[]
  dataTour?: string
}) {
  const daysUntilCollection = daysBetween(new Date().toISOString().split('T')[0], task.collection_deadline)
  const urgency = daysUntilCollection <= 0 ? '#dc2626' : daysUntilCollection <= 2 ? '#ea580c' : daysUntilCollection <= 7 ? '#ca8a04' : ACCENT

  return (
    <div data-tour={dataTour} style={{
      border: `1px solid #e2e8f0`,
      borderLeft: `4px solid ${urgency}`,
      borderRadius: '10px',
      background: '#fff',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: DARK }}>{task.task_title}</div>
          <div style={{ fontSize: '12px', color: MUTED, marginTop: '4px', display: 'flex', gap: '12px' }}>
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
            <span style={{ fontSize: '12px', color: MUTED }}>
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
        <div style={{ fontSize: '13px', fontWeight: 500, color: DARK }}>{item.header}</div>
        {item.upload && (
          <a href={item.upload.file_url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '11px', color: ACCENT, textDecoration: 'none' }}>
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
            background: uploading ? '#94a3b8' : ACCENT,
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
            fontSize: '11px', color: MUTED, background: '#fff',
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
              <div style={{ fontSize: '13px', fontWeight: 500, color: DARK }}>{dt.name}</div>
              {existing ? (
                <a href={existing.file_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: ACCENT, textDecoration: 'none' }}>
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
                color: existing ? MUTED : '#fff',
                background: busy ? '#94a3b8' : existing ? 'none' : ACCENT,
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

// ── Shell with sidebar ──────────────────────────────────────────────────────

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'about',     label: 'About',     icon: '🏠' },
  { id: 'deadlines', label: 'Deadlines', icon: '📅' },
  { id: 'documents', label: 'Documents', icon: '📁' },
  { id: 'history',   label: 'History',   icon: '📋' },
]

function PortalShell({
  orgName, clientName, children, onTour, activeTab, onTabChange, pendingCount,
}: {
  orgName: string
  clientName: string
  children: React.ReactNode
  onTour?: () => void
  activeTab: Tab
  onTabChange: (t: Tab) => void
  pendingCount?: number
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      colorScheme: 'light',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top header */}
      <div data-tour="portal-header" style={{ background: DARK, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>⚡ {orgName}</span>
          {clientName && <span style={{ fontSize: '12px', color: '#475569', padding: '2px 8px', background: 'rgba(255,255,255,0.07)', borderRadius: 20 }}>{clientName}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Client Portal</span>
          {onTour && (
            <button
              data-tour="portal-tour-btn"
              onClick={onTour}
              style={{ fontSize: '12px', fontWeight: 600, color: ACCENT, background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
            >
              ? Take a tour
            </button>
          )}
        </div>
      </div>

      {/* Mobile tab bar */}
      <div style={{
        display: 'flex',
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        overflowX: 'auto',
        flexShrink: 0,
      }} className="portal-mobile-tabs">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              flex: '1 0 auto',
              padding: '10px 16px',
              fontSize: '12px',
              fontWeight: activeTab === item.id ? 700 : 500,
              color: activeTab === item.id ? ACCENT : MUTED,
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === item.id ? ACCENT : 'transparent'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.id === 'deadlines' && (pendingCount ?? 0) > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: 10, padding: '1px 6px', marginLeft: 2 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left sidebar — hidden on mobile via inline media alternative */}
        <aside style={{
          width: 220,
          background: '#fff',
          borderRight: '1px solid #e2e8f0',
          padding: '24px 0',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }} className="portal-sidebar">
          <div style={{ padding: '0 16px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Navigation
            </div>
          </div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: activeTab === item.id ? 700 : 500,
                color: activeTab === item.id ? ACCENT : '#334155',
                background: activeTab === item.id ? 'rgba(13,148,136,0.08)' : 'none',
                border: 'none',
                borderLeft: `3px solid ${activeTab === item.id ? ACCENT : 'transparent'}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '16px', width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === 'deadlines' && (pendingCount ?? 0) > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: 10, padding: '1px 6px' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}

          <div style={{ flex: 1 }} />
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
              Powered by<br />
              <strong style={{ color: MUTED }}>upFloat</strong>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 80px' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .portal-sidebar { display: none !important; }
        }
        @media (min-width: 641px) {
          .portal-mobile-tabs { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: DARK, margin: '0 0 4px' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '13px', color: MUTED, margin: 0 }}>{subtitle}</p>}
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div style={{ padding: '32px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>{text}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: MUTED }}>Loading your portal…</p>
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
