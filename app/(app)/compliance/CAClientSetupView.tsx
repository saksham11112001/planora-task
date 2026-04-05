'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Search, Plus, ChevronDown, ChevronRight, Building2, X,
} from 'lucide-react'
import { toast } from '@/store/appStore'

/* ─── Types ───────────────────────────────────────────────────── */

interface Client { id: string; name: string; color: string }
interface Member { id: string; name: string; role: string }
interface CAMasterTask {
  id: string; code: string; name: string; group_name: string; task_type: string
  dates: Record<string, string>; days_before_due: number; priority: string
}
interface Assignment {
  id: string; master_task_id: string; client_id: string
  assignee_id: string | null; approver_id: string | null
  master_task?: CAMasterTask
}
interface TaskSelection {
  checked: boolean; assignee_id: string; approver_id: string
}

/* ─── Group colors ────────────────────────────────────────────── */

const GROUP_COLORS: Record<string, string> = {
  'GST':               '#1B5E20',
  'TDS / TCS':         '#0D47A1',
  'Income Tax':        '#4A148C',
  'ROC / Company Law': '#BF360C',
  'Accounting & MIS':  '#006064',
  'Audit':             '#37474F',
  'Labour & Payroll':  '#E65100',
  'NGO / FCRA':        '#880E4F',
  'Other':             '#455A64',
}

function groupColor(name: string): string {
  return GROUP_COLORS[name] ?? '#455A64'
}

/* ─── Add Client Modal ────────────────────────────────────────── */

const PRESET_COLORS = [
  '#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b',
]

interface AddClientModalProps {
  onClose: () => void
  onCreated: (client: Client) => void
}

function AddClientModal({ onClose, onCreated }: AddClientModalProps) {
  const [name, setName]       = useState('')
  const [color, setColor]     = useState(PRESET_COLORS[0])
  const [saving, setSaving]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      if (!res.ok) throw new Error('Failed to create client')
      const json = await res.json()
      const client: Client = json.data ?? json
      toast.success('Client created')
      onCreated(client)
    } catch {
      toast.error('Could not create client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 12, padding: 24,
          width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Add new client</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Client name
            </span>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Pvt Ltd"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', borderRadius: 8, fontSize: 14,
                border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 24 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              Color
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    border: color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer', padding: 0, boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface-alt)',
                color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: 'var(--brand)', color: '#fff',
                fontSize: 13, fontWeight: 600,
                cursor: (!name.trim() || saving) ? 'not-allowed' : 'pointer',
                opacity: (!name.trim() || saving) ? 0.6 : 1,
              }}
            >
              {saving ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Task Group Section ──────────────────────────────────────── */

interface TaskGroupProps {
  groupName: string
  tasks: CAMasterTask[]
  selections: Record<string, TaskSelection>
  members: Member[]
  onToggle: (taskId: string) => void
  onSelectChange: (taskId: string, field: 'assignee_id' | 'approver_id', value: string) => void
}

function TaskGroup({ groupName, tasks, selections, members, onToggle, onSelectChange }: TaskGroupProps) {
  const [open, setOpen] = useState(true)
  const color = groupColor(groupName)
  const checkedCount = tasks.filter(t => selections[t.id]?.checked).length

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Group header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px', background: 'var(--surface-subtle)',
          border: 'none', borderBottom: '1px solid var(--border)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {open
          ? <ChevronDown style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }} />
          : <ChevronRight style={{ width: 15, height: 15, color: 'var(--text-muted)', flexShrink: 0 }} />
        }
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {groupName}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99,
          background: checkedCount > 0 ? color + '22' : 'var(--surface-alt)',
          color: checkedCount > 0 ? color : 'var(--text-muted)',
          border: '1px solid ' + (checkedCount > 0 ? color + '44' : 'var(--border)'),
        }}>
          {checkedCount}/{tasks.length}
        </span>
      </button>

      {/* Task rows */}
      {open && tasks.map(task => {
        const sel = selections[task.id] ?? { checked: false, assignee_id: '', approver_id: '' }
        return (
          <div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px 10px 48px',
              borderBottom: '1px solid var(--border)',
              background: sel.checked ? 'var(--surface-alt)' : 'var(--surface)',
              transition: 'background 0.1s',
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => onToggle(task.id)}
              style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: sel.checked ? 'none' : '2px solid var(--border)',
                background: sel.checked ? 'var(--brand)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
            >
              {sel.checked && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* Task info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {task.task_type}
              </div>
            </div>

            {/* Assignee + Approver dropdowns (only when checked) */}
            {sel.checked && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Assignee</span>
                  <select
                    value={sel.assignee_id}
                    onChange={e => onSelectChange(task.id, 'assignee_id', e.target.value)}
                    style={{
                      fontSize: 12, padding: '4px 8px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                      color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Approver</span>
                  <select
                    value={sel.approver_id}
                    onChange={e => onSelectChange(task.id, 'approver_id', e.target.value)}
                    style={{
                      fontSize: 12, padding: '4px 8px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--surface-subtle)',
                      color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="">None</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────────── */

interface Props { userRole: string; financialYear?: string }

export function CAClientSetupView({ userRole, financialYear = '2026-27' }: Props) {
  const canEdit = ['owner', 'admin', 'manager'].includes(userRole)

  /* State */
  const [clients,        setClients]        = useState<Client[]>([])
  const [members,        setMembers]        = useState<Member[]>([])
  const [masterTasks,    setMasterTasks]    = useState<CAMasterTask[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [assignments,    setAssignments]    = useState<Assignment[]>([])
  const [selections,     setSelections]     = useState<Record<string, TaskSelection>>({})
  const [clientSearch,   setClientSearch]   = useState('')
  const [showAddModal,   setShowAddModal]   = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [loadingTasks,   setLoadingTasks]   = useState(false)

  /* Assignment count per client */
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({})

  /* Initial fetch */
  useEffect(() => {
    async function load() {
      try {
        const [cRes, mRes, mtRes] = await Promise.all([
          fetch('/api/clients'),
          fetch('/api/team'),
          fetch(`/api/ca/master?fy=${encodeURIComponent(financialYear)}`),
        ])
        const [cJson, mJson, mtJson] = await Promise.all([
          cRes.ok  ? cRes.json()  : { data: [] },
          mRes.ok  ? mRes.json()  : { data: [] },
          mtRes.ok ? mtRes.json() : { data: [] },
        ])
        setClients(Array.isArray(cJson) ? cJson : (cJson.data ?? []))
        setMembers(Array.isArray(mJson) ? mJson : (mJson.data ?? []))
        setMasterTasks(Array.isArray(mtJson) ? mtJson : (mtJson.data ?? []))
      } catch {
        toast.error('Failed to load data')
      }
    }
    void load()
  }, [financialYear])

  /* When a client is selected, load existing assignments */
  const loadAssignments = useCallback(async (clientId: string) => {
    setLoadingTasks(true)
    try {
      const res = await fetch(`/api/ca/assignments?client_id=${clientId}`)
      if (!res.ok) throw new Error('Failed to load assignments')
      const json = await res.json()
      const data: Assignment[] = Array.isArray(json) ? json : (json.data ?? [])
      setAssignments(data)

      /* Build selections from existing assignments */
      const sel: Record<string, TaskSelection> = {}
      data.forEach(a => {
        sel[a.master_task_id] = {
          checked: true,
          assignee_id: a.assignee_id ?? '',
          approver_id: a.approver_id ?? '',
        }
      })
      setSelections(sel)
    } catch {
      toast.error('Failed to load assignments for this client')
    } finally {
      setLoadingTasks(false)
    }
  }, [])

  function handleSelectClient(client: Client) {
    setSelectedClient(client)
    void loadAssignments(client.id)
  }

  /* Toggle task inclusion */
  function handleToggle(taskId: string) {
    setSelections(prev => {
      const existing = prev[taskId]
      if (existing?.checked) {
        return { ...prev, [taskId]: { checked: false, assignee_id: '', approver_id: '' } }
      }
      return { ...prev, [taskId]: { checked: true, assignee_id: existing?.assignee_id ?? '', approver_id: existing?.approver_id ?? '' } }
    })
  }

  /* Update assignee or approver in a selection */
  function handleSelectChange(taskId: string, field: 'assignee_id' | 'approver_id', value: string) {
    setSelections(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] ?? { checked: true, assignee_id: '', approver_id: '' }), [field]: value },
    }))
  }

  /* Save assignments */
  async function handleSave() {
    if (!selectedClient || !canEdit) return
    setSaving(true)
    try {
      /* Determine which tasks to add and which assignments to remove */
      const toAdd: { master_task_id: string; client_id: string; assignee_id: string | null; approver_id: string | null }[] = []
      const toRemove: string[] = []

      /* Existing assignment ids keyed by master_task_id */
      const existingByTaskId: Record<string, Assignment> = {}
      assignments.forEach(a => { existingByTaskId[a.master_task_id] = a })

      masterTasks.forEach(task => {
        const sel = selections[task.id]
        const existing = existingByTaskId[task.id]

        if (sel?.checked) {
          if (!existing) {
            /* New assignment */
            toAdd.push({
              master_task_id: task.id,
              client_id: selectedClient.id,
              assignee_id: sel.assignee_id || null,
              approver_id: sel.approver_id || null,
            })
          } else {
            /* Update if changed — delete + re-add */
            const changed =
              (sel.assignee_id || null) !== existing.assignee_id ||
              (sel.approver_id || null) !== existing.approver_id
            if (changed) {
              toRemove.push(existing.id)
              toAdd.push({
                master_task_id: task.id,
                client_id: selectedClient.id,
                assignee_id: sel.assignee_id || null,
                approver_id: sel.approver_id || null,
              })
            }
          }
        } else if (existing) {
          /* Unchecked but had assignment — remove */
          toRemove.push(existing.id)
        }
      })

      /* Execute deletes */
      await Promise.all(
        toRemove.map(id =>
          fetch(`/api/ca/assignments/${id}`, { method: 'DELETE' }).then(r => {
            if (!r.ok) throw new Error(`Failed to remove assignment ${id}`)
          })
        )
      )

      /* Execute adds */
      if (toAdd.length > 0) {
        const res = await fetch('/api/ca/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: toAdd }),
        })
        if (!res.ok) throw new Error('Failed to save assignments')
      }

      toast.success('Assignments saved')

      /* Reload to get fresh data + update assignment counts */
      await loadAssignments(selectedClient.id)
      const checkedCount = Object.values(selections).filter(s => s.checked).length
      setAssignmentCounts(prev => ({ ...prev, [selectedClient.id]: checkedCount }))
    } catch {
      toast.error('Failed to save assignments')
    } finally {
      setSaving(false)
    }
  }

  /* Group master tasks by group_name */
  const grouped = masterTasks.reduce<Record<string, CAMasterTask[]>>((acc, task) => {
    const g = task.group_name || 'Other'
    ;(acc[g] ??= []).push(task)
    return acc
  }, {})

  /* Filtered clients */
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  /* Add new client */
  function handleClientCreated(client: Client) {
    setClients(prev => [...prev, client])
    setShowAddModal(false)
    handleSelectClient(client)
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>

      {/* ── Left panel: Client list ─────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', background: 'var(--surface)',
        overflow: 'hidden',
      }}>
        {/* Search + Add */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Clients</span>
            {canEdit && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 7, border: 'none',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Plus style={{ width: 12, height: 12 }} />
                Add
              </button>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-subtle)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 10px',
          }}>
            <Search style={{ width: 13, height: 13, color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients…"
              style={{
                flex: 1, border: 'none', background: 'none', outline: 'none',
                fontSize: 12, color: 'var(--text-primary)',
              }}
            />
            {clientSearch && (
              <button onClick={() => setClientSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
                <X style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Client rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredClients.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {clients.length === 0 ? 'No clients yet' : 'No matches'}
            </div>
          )}
          {filteredClients.map(client => {
            const isSelected = selectedClient?.id === client.id
            const count = assignmentCounts[client.id] ?? 0
            return (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', border: 'none', textAlign: 'left',
                  background: isSelected ? 'var(--surface-alt)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--brand)' : '3px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: client.color, flexShrink: 0,
                }} />
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: isSelected ? 600 : 400,
                  color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {client.name}
                </span>
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                    background: 'var(--brand)', color: '#fff', flexShrink: 0,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right panel: Task assignments ────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>

        {!selectedClient ? (
          /* Empty state */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, color: 'var(--text-muted)',
          }}>
            <Building2 style={{ width: 36, height: 36, opacity: 0.35 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Select a client to manage their compliance tasks</p>
          </div>
        ) : (
          <>
            {/* Right panel header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedClient.color }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                {selectedClient.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                FY {financialYear}
              </span>
            </div>

            {/* Task groups — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingTasks ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Loading tasks…
                </div>
              ) : masterTasks.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No master tasks found for FY {financialYear}
                </div>
              ) : (
                Object.entries(grouped).map(([groupName, tasks]) => (
                  <TaskGroup
                    key={groupName}
                    groupName={groupName}
                    tasks={tasks}
                    selections={selections}
                    members={members}
                    onToggle={handleToggle}
                    onSelectChange={handleSelectChange}
                  />
                ))
              )}
            </div>

            {/* Sticky Save button */}
            {canEdit && (
              <div style={{
                padding: '12px 20px', borderTop: '1px solid var(--border)',
                background: 'var(--surface)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {Object.values(selections).filter(s => s.checked).length} tasks selected
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '9px 22px', borderRadius: 8, border: 'none',
                    background: 'var(--brand)', color: '#fff',
                    fontSize: 13, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save assignments'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add client modal */}
      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleClientCreated}
        />
      )}
    </div>
  )
}
