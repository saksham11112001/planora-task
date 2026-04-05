'use client'

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, X,
  RefreshCw, Calendar, Paperclip, AlertCircle,
} from 'lucide-react'
import { MONTH_KEYS, MONTH_LABELS, CA_GROUP_NAMES } from '@/lib/data/caDefaultTasks'
import type { MonthKey } from '@/lib/data/caDefaultTasks'
import { toast } from '@/store/appStore'

/* ─── Types ───────────────────────────────────────────────────── */

interface CAMasterTask {
  id: string
  code: string
  name: string
  group_name: string
  task_type: string
  financial_year: string
  dates: Record<string, string>
  days_before_due: number
  attachment_count: number
  attachment_headers: string[]
  priority: string
  sort_order: number
  is_active: boolean
}

interface Props {
  userRole: string
  financialYear?: string
}

/* ─── Constants ───────────────────────────────────────────────── */

const FY_OPTIONS = ['2025-26', '2026-27', '2027-28'] as const
type FYOption = typeof FY_OPTIONS[number]

const PRIORITY_OPTS = ['low', 'medium', 'high', 'urgent'] as const

const PRI_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  low:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  medium: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  high:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  urgent: { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' },
}

const GROUP_FILTER_ALL = 'All'
const GROUP_FILTERS = [GROUP_FILTER_ALL, ...CA_GROUP_NAMES] as const
type GroupFilter = typeof GROUP_FILTERS[number]

const isAdmin = (role: string) => ['admin', 'owner'].includes(role)

/* ─── Sub-components ──────────────────────────────────────────── */

/** Small pill for task_type */
function TypeBadge({ label }: { label: string }) {
  if (!label) return null
  return (
    <span style={{
      fontSize: 11, padding: '1px 7px', borderRadius: 999,
      background: 'var(--surface-alt)', color: 'var(--text-secondary)',
      border: '1px solid var(--border-light)', whiteSpace: 'nowrap',
      maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block',
    }}>
      {label}
    </span>
  )
}

/** Priority badge */
function PriorityBadge({ value }: { value: string }) {
  const s = PRI_STYLE[value] ?? PRI_STYLE.medium
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {value}
    </span>
  )
}

/** Date cell — teal if set, gray placeholder if empty */
function DateCell({
  monthKey, dateStr, editable,
  onSave, onClear,
}: {
  monthKey: MonthKey
  dateStr: string | undefined
  editable: boolean
  onSave: (iso: string) => void
  onClear: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const day = dateStr ? new Date(dateStr).getUTCDate() : null

  function openEdit() {
    if (!editable) return
    setInputVal(dateStr ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commit() {
    if (inputVal && inputVal !== dateStr) onSave(inputVal)
    setEditing(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <td style={{ padding: '4px 2px', verticalAlign: 'middle', minWidth: 52 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <input
            ref={inputRef}
            type="date"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
            style={{
              width: 50, fontSize: 10, padding: '2px 2px', borderRadius: 4,
              border: '1px solid var(--brand)', outline: 'none',
              background: 'var(--surface)', color: 'var(--text-primary)',
            }}
          />
          {dateStr && (
            <button
              onMouseDown={(e) => { e.preventDefault(); onClear(); setEditing(false) }}
              title="Clear date"
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                fontSize: 10, color: '#dc2626', background: 'none',
                border: 'none', cursor: 'pointer', padding: '1px 4px',
              }}
            >
              <X size={10} /> clear
            </button>
          )}
        </div>
      </td>
    )
  }

  return (
    <td
      onClick={openEdit}
      title={dateStr ?? `Set ${MONTH_LABELS[monthKey]} date`}
      style={{
        padding: '4px 2px', verticalAlign: 'middle', minWidth: 52, textAlign: 'center',
        cursor: editable ? 'pointer' : 'default',
      }}
    >
      {day !== null ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 22, borderRadius: 6, fontSize: 12, fontWeight: 600,
          background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4',
        }}>
          {day}
        </span>
      ) : (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 22, borderRadius: 6, fontSize: 12,
          background: 'var(--surface-subtle)', color: 'var(--text-muted)',
        }}>
          —
        </span>
      )}
    </td>
  )
}

/** Attachment headers popover */
function AttachHeadersCell({
  count, headers, editable,
  onSave,
}: {
  count: number
  headers: string[]
  editable: boolean
  onSave: (h: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  function openPopover() {
    if (!editable) return
    const filled = Array.from({ length: count }, (_, i) => headers[i] ?? '')
    setDraft(filled)
    setOpen(true)
  }

  function save() {
    onSave(draft)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) save()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, draft]) // eslint-disable-line react-hooks/exhaustive-deps

  const preview = count === 0
    ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
    : (
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: editable ? 'pointer' : 'default' }}>
        {headers.slice(0, 2).map((h, i) => (
          <span key={i} style={{ marginRight: 4, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
            {h || `#${i + 1}`}
          </span>
        ))}
        {count > 2 && <span style={{ color: 'var(--text-muted)' }}>+{count - 2}</span>}
      </span>
    )

  return (
    <td style={{ padding: '4px 6px', verticalAlign: 'middle', position: 'relative' }}>
      <div onClick={openPopover} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 }}>
        <Paperclip size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {preview}
      </div>
      {open && (
        <div ref={ref} style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          padding: 12, minWidth: 200,
        }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text-primary)' }}>
            Attachment headers ({count})
          </div>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <input
                value={draft[i] ?? ''}
                onChange={e => {
                  const next = [...draft]
                  next[i] = e.target.value
                  setDraft(next)
                }}
                placeholder={`Header ${i + 1}`}
                style={{
                  width: '100%', fontSize: 13, padding: '4px 8px',
                  border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--surface-alt)', color: 'var(--text-primary)', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setOpen(false)} style={btnGhost}>Cancel</button>
            <button onClick={save} style={btnPrimary}>Save</button>
          </div>
        </div>
      )}
    </td>
  )
}

/** Inline number input — saves on blur */
function NumberCell({
  value, min, max, editable, onChange,
}: {
  value: number
  min: number
  max: number
  editable: boolean
  onChange: (v: number) => void
}) {
  const [val, setVal] = useState(String(value))
  useEffect(() => setVal(String(value)), [value])

  function commit() {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= min && n <= max && n !== value) onChange(n)
    else setVal(String(value))
  }

  return (
    <td style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: 'center' }}>
      <input
        type="number"
        min={min}
        max={max}
        value={val}
        disabled={!editable}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit() }}
        style={{
          width: 52, textAlign: 'center', fontSize: 13,
          padding: '3px 4px', borderRadius: 6,
          border: editable ? '1px solid var(--border)' : 'none',
          background: editable ? 'var(--surface-alt)' : 'transparent',
          color: 'var(--text-primary)', outline: 'none',
          cursor: editable ? 'auto' : 'default',
        }}
      />
    </td>
  )
}

/* ─── Shared button styles ────────────────────────────────────── */

const btnPrimary: React.CSSProperties = {
  padding: '5px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
  background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 6, fontSize: 13,
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', cursor: 'pointer',
}

/* ─── Add Custom Task Modal ───────────────────────────────────── */

interface NewTaskDraft {
  name: string
  group_name: string
  task_type: string
  priority: string
  days_before_due: number
}

function AddTaskModal({
  financialYear,
  onClose,
  onSave,
}: {
  financialYear: string
  onClose: () => void
  onSave: (t: CAMasterTask) => void
}) {
  const [draft, setDraft] = useState<NewTaskDraft>({
    name: '', group_name: 'GST', task_type: '',
    priority: 'medium', days_before_due: 7,
  })
  const [saving, setSaving] = useState(false)

  function set<K extends keyof NewTaskDraft>(k: K, v: NewTaskDraft[K]) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  async function handleSave() {
    if (!draft.name.trim()) { toast.error('Task name is required'); return }
    setSaving(true)
    try {
      const code = `${draft.name.trim()} (${draft.task_type.trim() || 'Custom'})`
      const res = await fetch('/api/ca/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name: draft.name.trim(),
          group_name: draft.group_name,
          task_type: draft.task_type.trim(),
          financial_year: financialYear,
          dates: {},
          days_before_due: draft.days_before_due,
          attachment_count: 0,
          attachment_headers: [],
          priority: draft.priority,
          sort_order: 999,
        }),
      })
      const json = (await res.json()) as { data?: CAMasterTask; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed to create task')
      toast.success('Task created')
      onSave(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creating task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px 16px 0 0',
        padding: '28px 28px 36px', width: '100%', maxWidth: 560,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
            Add Custom Task
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Task name *</label>
            <input
              autoFocus
              value={draft.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. GST IFF Filing"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Group</label>
            <select value={draft.group_name} onChange={e => set('group_name', e.target.value)} style={inputStyle}>
              {CA_GROUP_NAMES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Task type</label>
            <input
              value={draft.task_type}
              onChange={e => set('task_type', e.target.value)}
              placeholder="e.g. Monthly, QRMP"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={draft.priority} onChange={e => set('priority', e.target.value)} style={inputStyle}>
              {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Days before due</label>
            <input
              type="number" min={1} max={365}
              value={draft.days_before_due}
              onChange={e => set('days_before_due', parseInt(e.target.value, 10) || 7)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 5,
}
const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: 14, padding: '7px 10px',
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface-alt)', color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box',
}

/* ─── TaskRow ─────────────────────────────────────────────────── */

function TaskRow({
  task, editable,
  onUpdate, onDelete,
}: {
  task: CAMasterTask
  editable: boolean
  onUpdate: (patch: Partial<CAMasterTask>) => Promise<void>
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(task.name)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => setNameDraft(task.name), [task.name])

  function commitName() {
    setNameEditing(false)
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== task.name) onUpdate({ name: trimmed })
    else setNameDraft(task.name)
  }

  function handleDateSave(month: MonthKey, iso: string) {
    const next = { ...task.dates, [month]: iso }
    onUpdate({ dates: next })
  }

  function handleDateClear(month: MonthKey) {
    const next = { ...task.dates }
    delete next[month]
    onUpdate({ dates: next })
  }

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'var(--surface-subtle)' : 'var(--surface)', transition: 'background 0.1s' }}
    >
      {/* Task name — sticky */}
      <td style={{
        padding: '6px 10px', verticalAlign: 'middle',
        position: 'sticky', left: 0, zIndex: 2,
        background: hovered ? 'var(--surface-subtle)' : 'var(--surface)',
        minWidth: 200, maxWidth: 240,
        borderRight: '1px solid var(--border-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {nameEditing ? (
            <>
              <input
                ref={nameRef}
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(task.name); setNameEditing(false) } }}
                style={{
                  flex: 1, fontSize: 13, padding: '2px 6px',
                  border: '1px solid var(--brand)', borderRadius: 5,
                  background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none',
                }}
                autoFocus
              />
              <button onClick={commitName} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488' }}>
                <Check size={14} />
              </button>
            </>
          ) : (
            <>
              <span style={{
                fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }} title={task.name}>
                {task.name}
              </span>
              {editable && (
                <button
                  onClick={() => { setNameEditing(true); setTimeout(() => nameRef.current?.focus(), 0) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                  title="Edit name"
                >
                  <Pencil size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </td>

      {/* Type — sticky */}
      <td style={{
        padding: '6px 8px', verticalAlign: 'middle',
        position: 'sticky', left: 200, zIndex: 2,
        background: hovered ? 'var(--surface-subtle)' : 'var(--surface)',
        minWidth: 110, maxWidth: 130,
        borderRight: '1px solid var(--border-light)',
      }}>
        <TypeBadge label={task.task_type} />
      </td>

      {/* Attach count */}
      <NumberCell
        value={task.attachment_count}
        min={0} max={10}
        editable={editable}
        onChange={v => onUpdate({ attachment_count: v, attachment_headers: task.attachment_headers.slice(0, v) })}
      />

      {/* Attach headers */}
      <AttachHeadersCell
        count={task.attachment_count}
        headers={task.attachment_headers}
        editable={editable}
        onSave={h => onUpdate({ attachment_headers: h })}
      />

      {/* Days before */}
      <NumberCell
        value={task.days_before_due}
        min={1} max={365}
        editable={editable}
        onChange={v => onUpdate({ days_before_due: v })}
      />

      {/* Priority */}
      <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
        {editable ? (
          <select
            value={task.priority}
            onChange={e => onUpdate({ priority: e.target.value })}
            style={{
              fontSize: 12, padding: '3px 6px', borderRadius: 999, fontWeight: 600,
              background: PRI_STYLE[task.priority]?.bg ?? '#fff',
              color: PRI_STYLE[task.priority]?.color ?? '#000',
              border: `1px solid ${PRI_STYLE[task.priority]?.border ?? '#ddd'}`,
              cursor: 'pointer', outline: 'none',
            }}
          >
            {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        ) : (
          <PriorityBadge value={task.priority} />
        )}
      </td>

      {/* Month date cells */}
      {MONTH_KEYS.map(mk => (
        <DateCell
          key={mk}
          monthKey={mk}
          dateStr={task.dates[mk]}
          editable={editable}
          onSave={iso => handleDateSave(mk, iso)}
          onClear={() => handleDateClear(mk)}
        />
      ))}

      {/* Actions */}
      <td style={{ padding: '4px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
        {editable && (
          <button
            onClick={onDelete}
            title="Delete task"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#dc2626', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
              padding: 4, borderRadius: 6,
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  )
}

/* ─── GroupSection ────────────────────────────────────────────── */

function GroupSection({
  groupName, tasks, editable,
  onUpdate, onDelete,
}: {
  groupName: string
  tasks: CAMasterTask[]
  editable: boolean
  onUpdate: (id: string, patch: Partial<CAMasterTask>) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <>
      {/* Group header row */}
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <td
          colSpan={6 + 12 + 1}
          style={{
            background: '#1e293b', color: '#fff',
            padding: '8px 14px', fontWeight: 700, fontSize: 13,
            position: 'sticky', left: 0, zIndex: 3,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            {groupName}
            <span style={{
              fontSize: 11, fontWeight: 400, background: 'rgba(255,255,255,0.15)',
              borderRadius: 999, padding: '1px 8px', marginLeft: 4,
            }}>
              {tasks.length}
            </span>
          </div>
        </td>
      </tr>

      {/* Task rows */}
      {expanded && tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          editable={editable}
          onUpdate={patch => onUpdate(task.id, patch)}
          onDelete={() => onDelete(task.id)}
        />
      ))}
    </>
  )
}

/* ─── Main Component ──────────────────────────────────────────── */

export function CAMasterView({ userRole, financialYear: initFY = '2026-27' }: Props) {
  const [fy, setFy] = useState<FYOption>(
    FY_OPTIONS.includes(initFY as FYOption) ? (initFY as FYOption) : '2026-27'
  )
  const [tasks, setTasks] = useState<CAMasterTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(GROUP_FILTER_ALL)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const canEdit = isAdmin(userRole)

  /* ── Fetch ── */
  const fetchTasks = useCallback(async (year: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ca/master?fy=${encodeURIComponent(year)}`)
      const json = (await res.json()) as { data?: CAMasterTask[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setTasks(json.data ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks(fy) }, [fy, fetchTasks])

  /* ── Load defaults ── */
  async function handleLoadDefaults() {
    setLoadingDefaults(true)
    try {
      const res = await fetch('/api/ca/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load_defaults', financial_year: fy }),
      })
      const json = (await res.json()) as { success?: boolean; count?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      toast.success(`Loaded ${json.count ?? 0} default tasks`)
      await fetchTasks(fy)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading defaults')
    } finally {
      setLoadingDefaults(false)
    }
  }

  /* ── Optimistic update ── */
  async function handleUpdate(id: string, patch: Partial<CAMasterTask>) {
    const prev = tasks.find(t => t.id === id)
    if (!prev) return
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t))
    try {
      const res = await fetch(`/api/ca/master/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = (await res.json()) as { data?: CAMasterTask; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
    } catch (err) {
      setTasks(ts => ts.map(t => t.id === id ? prev : t))
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  /* ── Optimistic delete ── */
  async function handleDelete(id: string) {
    const prev = tasks
    setTasks(ts => ts.filter(t => t.id !== id))
    setDeleteConfirm(null)
    try {
      const res = await fetch(`/api/ca/master/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Delete failed')
      toast.success('Task deleted')
    } catch (err) {
      setTasks(prev)
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  function requestDelete(id: string) {
    setDeleteConfirm(id)
  }

  /* ── Grouped + filtered tasks ── */
  const grouped = useMemo(() => {
    const filtered = groupFilter === GROUP_FILTER_ALL
      ? tasks
      : tasks.filter(t => t.group_name === groupFilter)
    const map = new Map<string, CAMasterTask[]>()
    for (const t of filtered) {
      if (!map.has(t.group_name)) map.set(t.group_name, [])
      map.get(t.group_name)!.push(t)
    }
    return map
  }, [tasks, groupFilter])

  /* ─── Render ────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
          <select
            value={fy}
            onChange={e => setFy(e.target.value as FYOption)}
            style={{
              fontSize: 14, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface-alt)',
              color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
            }}
          >
            {FY_OPTIONS.map(f => <option key={f} value={f}>FY {f}</option>)}
          </select>
        </div>

        {canEdit && (
          <button
            onClick={handleLoadDefaults}
            disabled={loadingDefaults}
            style={{
              ...btnGhost,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: loadingDefaults ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: loadingDefaults ? 'spin 1s linear infinite' : 'none' }} />
            {loadingDefaults ? 'Loading…' : 'Load defaults'}
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            Add custom task
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {loading ? (
            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tasks.length}</span> tasks
            </>
          )}
        </div>
      </div>

      {/* ── Group filter pills ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
        overflowX: 'auto',
      }}>
        {GROUP_FILTERS.map(g => {
          const active = g === groupFilter
          return (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              style={{
                fontSize: 12, fontWeight: active ? 700 : 500,
                padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                border: active ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                background: active ? 'var(--brand)' : 'var(--surface-alt)',
                color: active ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {g}
              {g !== GROUP_FILTER_ALL && (
                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                  {tasks.filter(t => t.group_name === g).length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* Loading spinner */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
            <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading tasks…</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 16 }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                No tasks yet for FY {fy}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                Load the default template to get started, or add custom tasks manually.
              </div>
              {canEdit && (
                <button
                  onClick={handleLoadDefaults}
                  disabled={loadingDefaults}
                  style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <RefreshCw size={15} style={{ animation: loadingDefaults ? 'spin 1s linear infinite' : 'none' }} />
                  {loadingDefaults ? 'Loading defaults…' : 'Load defaults from template'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        {!loading && tasks.length > 0 && (
          <div style={{ overflowX: 'auto', minWidth: 0 }}>
            <table style={{
              borderCollapse: 'collapse', width: '100%',
              fontSize: 13, tableLayout: 'auto',
            }}>
              {/* Header */}
              <thead>
                <tr style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 4, minWidth: 200, textAlign: 'left', background: 'var(--surface-alt)' }}>
                    Task name
                  </th>
                  <th style={{ ...thStyle, position: 'sticky', left: 200, zIndex: 4, minWidth: 110, background: 'var(--surface-alt)', borderRight: '1px solid var(--border-light)' }}>
                    Type
                  </th>
                  <th style={{ ...thStyle, minWidth: 60 }}>Attach#</th>
                  <th style={{ ...thStyle, minWidth: 100 }}>Headers</th>
                  <th style={{ ...thStyle, minWidth: 68 }}>Days before</th>
                  <th style={{ ...thStyle, minWidth: 90 }}>Priority</th>
                  {MONTH_KEYS.map(mk => (
                    <th key={mk} style={{ ...thStyle, minWidth: 52, width: 52, textAlign: 'center' }}>
                      {MONTH_LABELS[mk]}
                    </th>
                  ))}
                  <th style={{ ...thStyle, minWidth: 44 }} />
                </tr>
              </thead>

              <tbody>
                {Array.from(grouped.entries()).map(([groupName, groupTasks]) => (
                  <GroupSection
                    key={groupName}
                    groupName={groupName}
                    tasks={groupTasks}
                    editable={canEdit}
                    onUpdate={handleUpdate}
                    onDelete={requestDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog ── */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 12, padding: 28,
            maxWidth: 360, width: '90%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Trash2 size={20} style={{ color: '#dc2626' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Delete task?
              </h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
              This will permanently delete the task from the master list. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={btnGhost}>Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{ ...btnPrimary, background: '#dc2626' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add task modal ── */}
      {showAddModal && (
        <AddTaskModal
          financialYear={fy}
          onClose={() => setShowAddModal(false)}
          onSave={newTask => {
            setTasks(ts => [...ts, newTask])
            setShowAddModal(false)
          }}
        />
      )}

      {/* ── Spin keyframe (injected once) ── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', fontWeight: 600, fontSize: 12,
  color: 'var(--text-secondary)', textAlign: 'left',
  whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
}
