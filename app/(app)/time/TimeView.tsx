'use client'
import { useState, useTransition } from 'react'
import { useRouter }  from 'next/navigation'
import { Clock, Plus, DollarSign, Trash2, Pencil } from 'lucide-react'
import { fmtDate, fmtHours } from '@/lib/utils/format'
import { toast }             from '@/store/appStore'

interface Log {
  id: string; hours: number; is_billable: boolean; logged_date: string
  description: string | null; task_id: string | null; project_id: string | null
  user_id: string
  user:     { name: string }    | null
  projects: { name: string; color: string } | null
  tasks:    { title: string }   | null
}

interface Props {
  fromDate:      string
  toDate:        string
  logs:          Log[]
  projects:      { id: string; name: string; color: string }[]
  tasks:         { id: string; title: string; project_id: string | null }[]
  members:       { id: string; name: string }[]
  currentUserId: string
  canSeeAll:     boolean
}

export function TimeView({ logs, projects, tasks, members, currentUserId, canSeeAll, fromDate, toDate }: Props) {
  const router  = useRouter()
  const [, startT] = useTransition()

  // New entry form
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    hours: '', description: '',
    logged_date: new Date().toISOString().split('T')[0],
    project_id: '', task_id: '', is_billable: true,
  })

  // Inline edit
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editDesc,  setEditDesc]  = useState('')
  const [editBill,  setEditBill]  = useState(true)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  const totalHours    = logs.reduce((s, l) => s + l.hours, 0)
  const billableHours = logs.filter(l => l.is_billable).reduce((s, l) => s + l.hours, 0)
  const filteredTasks = form.project_id ? tasks.filter(t => t.project_id === form.project_id) : tasks

  // ── Date filter helpers ────────────────────────────────────────────
  function applyDateFilter() {
    const fromEl = document.getElementById('tf-from') as HTMLInputElement | null
    const toEl   = document.getElementById('tf-to')   as HTMLInputElement | null
    const from   = fromEl?.value
    const to     = toEl?.value
    if (from && to) router.push('/time?from=' + from + '&to=' + to)
  }

  function setThisMonth() {
    const now  = new Date()
    const y    = now.getFullYear()
    const mo   = String(now.getMonth() + 1).padStart(2, '0')
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    router.push('/time?from=' + y + '-' + mo + '-01&to=' + y + '-' + mo + '-' + String(last).padStart(2, '0'))
  }

  function setLast30() {
    const now    = new Date()
    const from30 = new Date(Date.now() - 30 * 86400000)
    const f      = from30.toISOString().split('T')[0]
    const t      = now.toISOString().split('T')[0]
    router.push('/time?from=' + f + '&to=' + t)
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  async function handleLog(e: React.FormEvent) {
    e.preventDefault()
    const h = parseFloat(form.hours)
    if (!form.hours || isNaN(h) || h <= 0) { toast.error('Enter valid hours > 0'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/time-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours:       h,
          description: form.description || null,
          logged_date: form.logged_date,
          project_id:  form.project_id || null,
          task_id:     form.task_id    || null,
          is_billable: form.is_billable,
        }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed'); return }
      toast.success('Time logged!')
      setShowForm(false)
      setForm({ hours: '', description: '', logged_date: new Date().toISOString().split('T')[0], project_id: '', task_id: '', is_billable: true })
      startT(() => router.refresh())
    } finally { setSaving(false) }
  }

  function handleEdit(log: Log) {
    setEditId(log.id)
    setEditHours(String(log.hours))
    setEditDesc(log.description ?? '')
    setEditBill(log.is_billable)
  }

  async function saveEdit(id: string) {
    const h = parseFloat(editHours)
    if (isNaN(h) || h <= 0) { toast.error('Invalid hours'); return }
    const res = await fetch('/api/time-logs/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: h, description: editDesc || null, is_billable: editBill }),
    })
    if (res.ok) { toast.success('Updated'); setEditId(null); startT(() => router.refresh()) }
    else        { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this time entry?')) return
    setDeleting(id)
    const res = await fetch('/api/time-logs/' + id, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) { toast.success('Deleted'); startT(() => router.refresh()) }
    else        { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time tracking</h1>
          <p className="text-sm text-gray-500 mt-1">{fromDate} → {toDate}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn btn-brand flex items-center gap-2">
          <Plus className="h-4 w-4"/> Log time
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card-elevated p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-gray-400"/>
          <p className="text-2xl font-bold text-gray-900">{fmtHours(totalHours)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total logged</p>
        </div>
        <div className="card-elevated p-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500"/>
          <p className="text-2xl font-bold text-green-600">{fmtHours(billableHours)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Billable hours</p>
        </div>
        <div className="card-elevated p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-gray-300"/>
          <p className="text-2xl font-bold text-gray-400">{fmtHours(totalHours - billableHours)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Non-billable</p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="card mb-4 flex items-center gap-3 px-4 py-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500">Period:</span>
        <input type="date" id="tf-from" defaultValue={fromDate}
          className="input" style={{ width: 150, padding: '5px 10px', fontSize: 13 }}/>
        <span className="text-xs text-gray-400">to</span>
        <input type="date" id="tf-to" defaultValue={toDate}
          className="input" style={{ width: 150, padding: '5px 10px', fontSize: 13 }}/>
        <button onClick={applyDateFilter} className="btn btn-brand btn-sm">Apply</button>
        <button onClick={setThisMonth}    className="btn btn-outline btn-sm">This month</button>
        <button onClick={setLast30}       className="btn btn-outline btn-sm">Last 30 days</button>
      </div>

      {/* Log form */}
      {showForm && (
        <form onSubmit={handleLog} className="card-elevated p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">New time entry</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hours *</label>
              <input type="number" step="0.25" min="0.25" value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                className="input" placeholder="2.5" required/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={form.logged_date}
                onChange={e => setForm(f => ({ ...f, logged_date: e.target.value }))}
                className="input"/>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_billable}
                  onChange={e => setForm(f => ({ ...f, is_billable: e.target.checked }))}
                  style={{ accentColor: '#0d9488', width: 16, height: 16 }}/>
                <span className="text-sm text-gray-700">Billable</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
              <select value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value, task_id: '' }))}
                className="input">
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Task</label>
              <select value={form.task_id}
                onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}
                className="input">
                <option value="">No specific task</option>
                {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input" placeholder="What did you work on?"/>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn btn-brand">
              {saving ? 'Saving...' : 'Log time'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Log table */}
      <div className="card-elevated overflow-hidden">
        <div className="grid px-4 py-2.5 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide"
          style={{ gridTemplateColumns: '1fr 8rem 6rem 5rem 5rem 4rem', background: 'var(--surface-subtle)', borderColor: 'var(--border)' }}>
          <div>Description / Task</div>
          <div className="hidden md:block">Project</div>
          <div className="text-center">Date</div>
          <div className="text-center">Hours</div>
          <div className="text-center">Billable</div>
          <div/>
        </div>

        {logs.length === 0 && (
          <div className="py-12 text-center">
            <Clock className="h-8 w-8 text-gray-200 mx-auto mb-2"/>
            <p className="text-sm text-gray-400">No time logged in this period</p>
          </div>
        )}

        {logs.map(log => (
          <div key={log.id}>
            {/* Main row */}
            <div className="grid items-center px-4 py-3 border-b hover:bg-gray-50 transition-colors"
              style={{ gridTemplateColumns: '1fr 8rem 6rem 5rem 5rem 4rem', borderColor: 'var(--border)' }}>

              <div className="min-w-0">
                {log.tasks
                  ? <p className="text-sm font-medium text-gray-900 truncate">{log.tasks.title}</p>
                  : <p className="text-sm text-gray-600 truncate">{log.description ?? 'No description'}</p>}
                {log.description && log.tasks && (
                  <p className="text-xs text-gray-400 truncate">{log.description}</p>
                )}
                {canSeeAll && log.user && (
                  <p className="text-xs text-gray-400">{log.user.name}</p>
                )}
              </div>

              <div className="hidden md:flex items-center gap-1.5 min-w-0">
                {log.projects && (
                  <>
                    <div className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: log.projects.color }}/>
                    <span className="text-xs text-gray-500 truncate">{log.projects.name}</span>
                  </>
                )}
              </div>

              <div className="text-center text-xs text-gray-400">{fmtDate(log.logged_date)}</div>

              <div className="text-center">
                <span className="text-sm font-semibold text-gray-900">{fmtHours(log.hours)}</span>
              </div>

              <div className="text-center">
                {log.is_billable
                  ? <span className="text-xs text-green-600 font-medium">Yes</span>
                  : <span className="text-xs text-gray-400">No</span>}
              </div>

              <div className="flex justify-center gap-1">
                {(log.user_id === currentUserId || canSeeAll) && (
                  <>
                    <button onClick={() => handleEdit(log)}
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-300 hover:text-teal-500 hover:bg-teal-50 transition-colors">
                      <Pencil className="h-3.5 w-3.5"/>
                    </button>
                    <button onClick={() => handleDelete(log.id)} disabled={deleting === log.id}
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inline edit row */}
            {editId === log.id && (
              <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap"
                style={{ background: 'var(--brand-light)', borderColor: 'var(--brand-border)' }}>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Hours</label>
                  <input type="number" step="0.25" min="0.25" value={editHours}
                    onChange={e => setEditHours(e.target.value)}
                    className="input" style={{ width: 80 }}/>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-gray-500">Note</label>
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                    placeholder="Description…" className="input flex-1"/>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={editBill}
                    onChange={e => setEditBill(e.target.checked)}
                    style={{ accentColor: '#0d9488' }}/>
                  Billable
                </label>
                <button onClick={() => saveEdit(log.id)} className="btn btn-brand btn-sm">Save</button>
                <button onClick={() => setEditId(null)}  className="btn btn-outline btn-sm">Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
