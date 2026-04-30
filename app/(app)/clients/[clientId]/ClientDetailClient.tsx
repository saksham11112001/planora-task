'use client'
import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Phone, Mail, Users, Video, FileText, Trash2, Send } from 'lucide-react'
import { toast } from '@/store/appStore'
import { fmtDate } from '@/lib/utils/format'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'
import type { Task } from '@/types'

interface Note {
  id: string; content: string; type: string; created_at: string
  users: { id: string; name: string } | null
}

interface Invoice {
  id: string; invoice_number: string; status: string; total: number; due_date: string | null; issue_date: string
}

const NOTE_TYPES = [
  { value: 'note',      label: 'Note',     icon: FileText,       color: '#64748b' },
  { value: 'call',      label: 'Call',     icon: Phone,          color: '#16a34a' },
  { value: 'meeting',   label: 'Meeting',  icon: Users,          color: '#7c3aed' },
  { value: 'email',     label: 'Email',    icon: Mail,           color: '#0891b2' },
  { value: 'whatsapp',  label: 'WhatsApp', icon: MessageSquare,  color: '#25d366' },
  { value: 'video',     label: 'Video call',icon: Video,         color: '#ea580c' },
]

const INV_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',   color: '#64748b', bg: '#f1f5f9' },
  sent:      { label: 'Sent',    color: '#0891b2', bg: '#e0f2fe' },
  paid:      { label: 'Paid',    color: '#16a34a', bg: '#dcfce7' },
  overdue:   { label: 'Overdue', color: '#dc2626', bg: '#fee2e2' },
  cancelled: { label: 'Canc.',   color: '#94a3b8', bg: '#f8fafc' },
}

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

interface Props {
  clientId:     string
  canManage:    boolean
  currentUserId: string
}

export function ClientDetailClient({ clientId, canManage, currentUserId }: Props) {
  const [tab,      setTab]      = useState<'tasks'|'notes'|'invoices'>('tasks')
  const [notes,    setNotes]    = useState<Note[]>([])
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(false)
  const loaded = useRef<Set<string>>(new Set())

  // Draft new note state
  const [noteText,  setNoteText]  = useState('')
  const [noteType,  setNoteType]  = useState('note')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loaded.current.has(tab)) return
    loaded.current.add(tab)
    setLoading(true)

    const fetchMap: Record<string, () => Promise<void>> = {
      notes: async () => {
        const r = await fetch(`/api/clients/${clientId}/notes`)
        const d = await r.json()
        if (d.data) setNotes(d.data)
      },
      tasks: async () => {
        const r = await fetch(`/api/tasks?client_id=${clientId}&limit=100`)
        const d = await r.json()
        if (d.data) setTasks(d.data)
      },
      invoices: async () => {
        const r = await fetch(`/api/invoices?client_id=${clientId}`)
        const d = await r.json()
        if (d.data) setInvoices(d.data)
      },
    }
    fetchMap[tab]?.().catch(() => {}).finally(() => setLoading(false))
  }, [tab, clientId])

  async function addNote() {
    if (!noteText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText.trim(), type: noteType }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      setNotes(prev => [d.data, ...prev])
      setNoteText('')
      toast.success('Note added')
    } finally { setSubmitting(false) }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    const res = await fetch(`/api/clients/${clientId}/notes?noteId=${id}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== id))
    else toast.error('Failed to delete')
  }

  const openTasks    = tasks.filter(t => !['completed','cancelled'].includes(t.status))
  const doneTasks    = tasks.filter(t => t.status === 'completed')
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date && t.due_date < new Date().toISOString().slice(0,10))

  const TAB_BTN = (key: typeof tab, label: string, count?: number) => (
    <button onClick={() => setTab(key)}
      style={{
        padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: tab === key ? 600 : 400,
        background: tab === key ? 'var(--brand)' : 'transparent',
        color: tab === key ? '#fff' : 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ background: tab === key ? 'rgba(255,255,255,0.25)' : 'var(--surface-subtle)',
          color: tab === key ? '#fff' : 'var(--text-muted)',
          borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '0 5px', minWidth: 16, textAlign: 'center' }}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <div style={{ marginTop: 24 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface-subtle)',
        padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border-light)' }}>
        {TAB_BTN('tasks',    'Tasks',    tasks.length)}
        {TAB_BTN('notes',    'Activity', notes.length)}
        {TAB_BTN('invoices', 'Invoices', invoices.length)}
      </div>

      {/* ── Tasks tab ── */}
      {tab === 'tasks' && (
        <div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : tasks.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No tasks linked to this client yet</p>
            </div>
          ) : (
            <div>
              {overdueTasks.length > 0 && (
                <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>⚠ {overdueTasks.length} overdue</p>
              )}
              {/* Open tasks */}
              {openTasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Open ({openTasks.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {openTasks.map(t => <TaskRow key={t.id} task={t}/>)}
                  </div>
                </div>
              )}
              {/* Done tasks (collapsed) */}
              {doneTasks.length > 0 && (
                <details>
                  <summary style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>▶ Completed ({doneTasks.length})</span>
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    {doneTasks.slice(0, 20).map(t => <TaskRow key={t.id} task={t}/>)}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Notes / Activity tab ── */}
      {tab === 'notes' && (
        <div>
          {/* New note composer */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {NOTE_TYPES.map(nt => {
                const Icon = nt.icon
                return (
                  <button key={nt.value} onClick={() => setNoteType(nt.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                      border: `1px solid ${noteType === nt.value ? nt.color : 'var(--border)'}`,
                      background: noteType === nt.value ? `${nt.color}12` : 'var(--surface-subtle)',
                      color: noteType === nt.value ? nt.color : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 11, fontWeight: noteType === nt.value ? 600 : 400, fontFamily: 'inherit' }}>
                    <Icon style={{ width: 11, height: 11 }}/> {nt.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={noteText} onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote() }}
                placeholder={`Log a ${NOTE_TYPES.find(n => n.value === noteType)?.label.toLowerCase() ?? 'note'}… (Ctrl+Enter to save)`}
                rows={2}
                style={{ flex: 1, resize: 'vertical' as const, minHeight: 52, padding: '8px 10px',
                  borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}/>
              <button onClick={addNote} disabled={submitting || !noteText.trim()}
                style={{ alignSelf: 'flex-end', padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: noteText.trim() ? 'var(--brand)' : 'var(--border)',
                  color: '#fff', cursor: noteText.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Send style={{ width: 13, height: 13 }}/>
              </button>
            </div>
          </div>

          {/* Notes list */}
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : notes.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <MessageSquare style={{ width: 32, height: 32, color: 'var(--border)', margin: '0 auto 10px' }}/>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No activity logged yet</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '4px 0 0' }}>Log calls, meetings, emails and notes above</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes.map(note => {
                const typeCfg = NOTE_TYPES.find(t => t.value === note.type) ?? NOTE_TYPES[0]
                const Icon    = typeCfg.icon
                const isOwn   = note.users?.id === currentUserId
                return (
                  <div key={note.id} style={{ display: 'flex', gap: 10, padding: '12px 14px',
                    background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border-light)',
                    alignItems: 'flex-start' }}>
                    {/* Type icon badge */}
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${typeCfg.color}12`,
                      border: `1px solid ${typeCfg.color}30`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 14, height: 14, color: typeCfg.color }}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: typeCfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{typeCfg.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {note.users?.name ?? 'Unknown'}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmtDate(note.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{note.content}</p>
                    </div>
                    {(isOwn || canManage) && (
                      <button onClick={() => deleteNote(note.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2,
                          opacity: 0.5, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.5'}>
                        <Trash2 style={{ width: 13, height: 13 }}/>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Invoices tab ── */}
      {tab === 'invoices' && (
        <div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No invoices for this client</p>
              {canManage && (
                <a href="/invoices" style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginTop: 8, display: 'block' }}>
                  Create invoice →
                </a>
              )}
            </div>
          ) : (
            <div>
              {/* Outstanding summary */}
              {(() => {
                const outstanding = invoices.filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + i.total, 0)
                const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
                return outstanding > 0 ? (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ padding: '8px 14px', borderRadius: 8, background: '#e0f2fe', border: '1px solid #bae6fd' }}>
                      <p style={{ fontSize: 10, color: '#0891b2', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#0891b2', margin: 0 }}>{fmtINR(outstanding)}</p>
                    </div>
                    <div style={{ padding: '8px 14px', borderRadius: 8, background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                      <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total paid</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', margin: 0 }}>{fmtINR(paid)}</p>
                    </div>
                  </div>
                ) : null
              })()}

              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {invoices.map((inv, i) => {
                  const cfg = INV_STATUS[inv.status] ?? INV_STATUS.draft
                  return (
                    <a key={inv.id} href="/invoices"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                        borderBottom: i < invoices.length - 1 ? '1px solid var(--border-light)' : 'none',
                        textDecoration: 'none', color: 'inherit', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{inv.invoice_number}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                          {fmtDate(inv.issue_date)}{inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ''}
                        </p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtINR(inv.total)}</span>
                      <span style={{ padding: '2px 10px', borderRadius: 20, background: cfg.bg, fontSize: 11, fontWeight: 600, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Task row component ────────────────────────────────────────────────────────
function TaskRow({ task }: { task: Task }) {
  const priCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none
  const stCfg  = STATUS_CONFIG[task.status]     ?? STATUS_CONFIG.todo
  const isOverdue = task.status !== 'completed' && task.due_date && task.due_date < new Date().toISOString().slice(0,10)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
      background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: priCfg.dot, flexShrink: 0 }}/>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {task.assignee && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{task.assignee.name}</span>
      )}
      {task.due_date && (
        <span style={{ fontSize: 11, color: isOverdue ? '#dc2626' : 'var(--text-muted)', fontWeight: isOverdue ? 600 : 400, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {fmtDate(task.due_date)}
        </span>
      )}
      <span style={{ padding: '2px 8px', borderRadius: 20, background: stCfg.bg, fontSize: 10, fontWeight: 600, color: stCfg.color, flexShrink: 0 }}>
        {stCfg.label}
      </span>
    </div>
  )
}
