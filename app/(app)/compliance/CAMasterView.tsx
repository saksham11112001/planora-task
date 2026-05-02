'use client'

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, X,
  RefreshCw, Calendar, Paperclip, AlertCircle, Save, Search,
  UploadCloud, Download, FileText,
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
  is_user_saved: boolean
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

/* ─── Searchable select option sets ──────────────────────────── */

interface SelectOption { value: string; label: string; description?: string }

const FY_SELECT_OPTS: SelectOption[] = FY_OPTIONS.map(f => ({ value: f, label: `FY ${f}` }))
const PRIORITY_SELECT_OPTS: SelectOption[] = [
  { value: 'low',    label: 'Low',    description: 'Can be addressed later' },
  { value: 'medium', label: 'Medium', description: 'Normal workflow timeline' },
  { value: 'high',   label: 'High',   description: 'Needs attention soon' },
  { value: 'urgent', label: 'Urgent', description: 'Immediate action required' },
]
const GROUP_SELECT_OPTS: SelectOption[] = CA_GROUP_NAMES.map(g => ({ value: g, label: g }))
const FREQ_SELECT_OPTS: SelectOption[] = [
  { value: 'monthly',     label: 'Monthly',     description: 'Due each month' },
  { value: 'quarterly',   label: 'Quarterly',   description: 'Due every 3 months' },
  { value: 'half_yearly', label: 'Half-yearly', description: 'Due every 6 months' },
  { value: 'annual',      label: 'Annual',      description: 'Due once per year' },
]
const MONTH_SELECT_OPTS: SelectOption[] = [
  { value: 'apr', label: 'Apr' }, { value: 'may', label: 'May' },
  { value: 'jun', label: 'Jun' }, { value: 'jul', label: 'Jul' },
  { value: 'aug', label: 'Aug' }, { value: 'sep', label: 'Sep' },
  { value: 'oct', label: 'Oct' }, { value: 'nov', label: 'Nov' },
  { value: 'dec', label: 'Dec' }, { value: 'jan', label: 'Jan' },
  { value: 'feb', label: 'Feb' }, { value: 'mar', label: 'Mar' },
]

/* ─── Attachment Template types + helpers ─────────────────────── */

interface AttachTemplate {
  id: string
  name: string
  items: string[]
}

const ATT_TMPL_KEY = 'ca_att_templates'
const ATT_SEL_KEY  = 'ca_task_tmpl_sel'  // Record<taskId, templateId[]>

const DEFAULT_TEMPLATES: AttachTemplate[] = [
  { id: 'dflt-1', name: 'Computation',   items: ['Computation Sheet'] },
  { id: 'dflt-2', name: 'Returns',        items: ['Filed Return', 'Acknowledgement'] },
  { id: 'dflt-3', name: 'Challans',       items: ['Challan Copy'] },
  { id: 'dflt-4', name: 'Bank Docs',      items: ['Bank Statement', 'Bank Certificate'] },
  { id: 'dflt-5', name: 'ROC',            items: ['Form MGT-7', 'Form AOC-4', 'Director Report'] },
  { id: 'dflt-6', name: 'Balance Sheet',  items: ['Balance Sheet', 'P&L Account', 'Notes to Accounts'] },
  { id: 'dflt-7', name: 'Income Tax',     items: ['ITR Form', 'Computation', 'Form 26AS'] },
]

function loadAttTemplates(): AttachTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES
  try {
    const raw = localStorage.getItem(ATT_TMPL_KEY)
    if (!raw) return DEFAULT_TEMPLATES
    return JSON.parse(raw) as AttachTemplate[]
  } catch { return DEFAULT_TEMPLATES }
}
function saveAttTemplates(ts: AttachTemplate[]): void {
  try { localStorage.setItem(ATT_TMPL_KEY, JSON.stringify(ts)) } catch {}
}
function loadTaskSel(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(ATT_SEL_KEY) ?? '{}') as Record<string, string[]> } catch { return {} }
}
function saveTaskSel(m: Record<string, string[]>): void {
  try { localStorage.setItem(ATT_SEL_KEY, JSON.stringify(m)) } catch {}
}
function mergeTemplateItems(templateIds: string[], templates: AttachTemplate[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of templateIds) {
    const t = templates.find(t => t.id === id)
    if (!t) continue
    for (const item of t.items) {
      if (!seen.has(item)) { seen.add(item); result.push(item) }
    }
  }
  return result
}

/* ─── Quick-fill helper ───────────────────────────────────────── */

function parseYears(fy: string): [number, number] {
  const parts = fy.split('-')
  const start = parseInt(parts[0])
  const end = parseInt(parts[0].slice(0, 2) + parts[1])
  return [start, end]
}

const FY_MONTH_DEFS = (fy: string) => {
  const [sy, ey] = parseYears(fy)
  return [
    { k: 'apr' as MonthKey, y: sy, m: 4 }, { k: 'may' as MonthKey, y: sy, m: 5 },
    { k: 'jun' as MonthKey, y: sy, m: 6 }, { k: 'jul' as MonthKey, y: sy, m: 7 },
    { k: 'aug' as MonthKey, y: sy, m: 8 }, { k: 'sep' as MonthKey, y: sy, m: 9 },
    { k: 'oct' as MonthKey, y: sy, m: 10 }, { k: 'nov' as MonthKey, y: sy, m: 11 },
    { k: 'dec' as MonthKey, y: sy, m: 12 }, { k: 'jan' as MonthKey, y: ey, m: 1 },
    { k: 'feb' as MonthKey, y: ey, m: 2 }, { k: 'mar' as MonthKey, y: ey, m: 3 },
  ]
}

function fmtDate(year: number, month: number, day: number): string {
  const maxDay = new Date(year, month, 0).getDate()
  const d = Math.min(day, maxDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function autoFillDates(
  freq: string, day: number, startMonth: MonthKey, fy: string
): Record<string, string> {
  const months = FY_MONTH_DEFS(fy)
  const result: Record<string, string> = {}
  const startIdx = months.findIndex(x => x.k === startMonth)
  const base = startIdx >= 0 ? startIdx : 0

  const step = freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : freq === 'half_yearly' ? 6 : 12

  for (let i = base; i < months.length; i += step) {
    const { k, y, m } = months[i]
    result[k] = fmtDate(y, m, day)
  }
  return result
}

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
  const [alignRight, setAlignRight] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  function openPopover(e: React.MouseEvent) {
    if (!editable) return
    const td = (e.currentTarget as HTMLElement).closest('td')
    if (td) {
      const r = td.getBoundingClientRect()
      setAlignRight(r.left + 200 > window.innerWidth - 8)
    }
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
    : <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{count}</span>

  return (
    <td style={{ padding: '4px 6px', verticalAlign: 'middle', position: 'relative' }}>
      <div onClick={openPopover} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 }}>
        <Paperclip size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {preview}
      </div>
      {open && (
        <div ref={ref} style={{
          position: 'absolute', top: '100%', ...(alignRight ? {right:0} : {left:0}), zIndex: 50,
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

/** Per-task template selector — multi-check dropdown with per-template preview */
function TemplateSelectCell({
  templates,
  selectedIds,
  editable,
  onSelect,
}: {
  templates: AttachTemplate[]
  selectedIds: string[]
  editable: boolean
  onSelect: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setPreviewId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectedTemplates = selectedIds
    .map(id => templates.find(t => t.id === id))
    .filter((t): t is AttachTemplate => Boolean(t))

  return (
    <td style={{ padding: '4px 6px', verticalAlign: 'middle', position: 'relative', minWidth: 150 }}>
      <div ref={ref}>
        {/* Trigger */}
        <div
          onClick={(e) => {
            if (!editable) return
            if (!open) {
              const td = (e.currentTarget as HTMLElement).closest('td')
              if (td) {
                const r = td.getBoundingClientRect()
                setAlignRight(r.left + 250 > window.innerWidth - 8)
              }
            }
            setOpen(o => !o)
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', cursor: editable ? 'pointer' : 'default' }}
        >
          {selectedTemplates.length > 0 ? (
            <>
              {selectedTemplates.map(t => (
                <span key={t.id} style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 10,
                  background: 'rgba(13,148,136,0.12)', color: '#0d9488',
                  border: '1px solid rgba(13,148,136,0.3)', fontWeight: 600, whiteSpace: 'nowrap',
                }}>{t.name}</span>
              ))}
              {editable && <ChevronDown size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>}
            </>
          ) : editable ? (
            <span style={{
              fontSize: 11, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 6,
              border: '1px dashed rgba(13,148,136,0.4)', background: 'rgba(13,148,136,0.04)',
            }}>
              <Plus size={9}/> Templates
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
          )}
        </div>

        {/* Dropdown */}
        {open && editable && (
          <div style={{
            position: 'absolute', top: '100%', ...(alignRight ? {right:0} : {left:0}), zIndex: 100,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            minWidth: 250, padding: 8, marginTop: 4,
          }}>
            {templates.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 8px', textAlign: 'center' }}>
                No templates yet.<br/>
                <span style={{ fontSize: 11 }}>Use "Manage Templates" in the toolbar to create some.</span>
              </div>
            ) : templates.map(tpl => {
              const checked = selectedIds.includes(tpl.id)
              const isPrev = previewId === tpl.id
              return (
                <div key={tpl.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 7,
                    background: checked ? 'rgba(13,148,136,0.08)' : 'transparent',
                    cursor: 'pointer',
                  }}
                    onClick={() => {
                      const next = checked ? selectedIds.filter(id => id !== tpl.id) : [...selectedIds, tpl.id]
                      onSelect(next)
                    }}
                  >
                    <input
                      type="checkbox" checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selectedIds.filter(id => id !== tpl.id)
                          : [...selectedIds, tpl.id]
                        onSelect(next)
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 13, height: 13, accentColor: '#0d9488', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: checked ? '#0d9488' : 'var(--text-primary)' }}>{tpl.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tpl.items.length} attachment{tpl.items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewId(isPrev ? null : tpl.id) }}
                      title="Preview attachments"
                      style={{
                        background: isPrev ? 'rgba(13,148,136,0.12)' : 'none',
                        border: 'none', cursor: 'pointer', padding: '2px 5px',
                        borderRadius: 4, fontSize: 11,
                        color: isPrev ? '#0d9488' : 'var(--text-muted)',
                        flexShrink: 0, fontFamily: 'inherit',
                      }}
                    >👁</button>
                  </div>
                  {isPrev && (
                    <div style={{
                      margin: '2px 8px 6px 28px', padding: '8px 10px',
                      background: 'var(--surface-subtle)', borderRadius: 6,
                      border: '1px solid var(--border)',
                    }}>
                      {tpl.items.length === 0 ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No attachments defined</span>
                      ) : tpl.items.map((item, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '1px 0', display: 'flex', gap: 6 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 14, textAlign: 'right' }}>{i + 1}.</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {/* Summary of merged result */}
            {selectedTemplates.length > 0 && (
              <div style={{
                marginTop: 8, padding: '8px 10px',
                background: 'rgba(13,148,136,0.06)', borderRadius: 8,
                border: '1px solid rgba(13,148,136,0.2)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Merged result — {mergeTemplateItems(selectedIds, templates).length} attachments
                </div>
                {mergeTemplateItems(selectedIds, templates).map((item, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '1px 0', display: 'flex', gap: 5 }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 12, textAlign: 'right' }}>{i + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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

/** Quick-fill popover: set frequency + day → auto-populate all month cells */
function QuickFillCell({
  taskId, fy, editable,
  onApply,
}: {
  taskId: string
  fy: string
  editable: boolean
  onApply: (dates: Record<string, string>) => void
}) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [freq, setFreq] = useState('monthly')
  const [day, setDay] = useState(7)
  const [startMonth, setStartMonth] = useState<MonthKey>('apr')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!editable) return <td style={{ width: 32 }} />

  return (
    <td style={{ padding: '2px 4px', verticalAlign: 'middle', position: 'relative', width: 32 }}>
      <button
        onClick={(e) => {
          if (!open) {
            const td = (e.currentTarget as HTMLElement).closest('td')
            if (td) {
              const r = td.getBoundingClientRect()
              setAlignRight(r.left + 220 > window.innerWidth - 8)
            }
          }
          setOpen(o => !o)
        }}
        title="Quick fill dates"
        style={{
          background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
          borderRadius: 6, padding: '2px 5px', fontSize: 11, color: 'var(--brand)',
          display: 'flex', alignItems: 'center', gap: 2,
        }}
      >
        ✦
      </button>
      {open && (
        <div ref={ref} style={{
          position: 'absolute', top: '100%', ...(alignRight ? {right:0} : {left:0}), zIndex: 60,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          padding: 14, minWidth: 220, marginTop: 4,
        }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 10 }}>
            Quick fill dates
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Frequency</label>
              <SearchableSelect
                value={freq}
                options={FREQ_SELECT_OPTS}
                onChange={setFreq}
                wrapperStyle={{ width: '100%' }}
                buttonStyle={{
                  width: '100%', fontSize: 12, padding: '4px 8px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--surface-alt)',
                  color: 'var(--text-primary)', boxSizing: 'border-box',
                }}
                dropdownWidth={200}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Day of month</label>
                <input
                  type="number" min={1} max={31} value={day}
                  onChange={e => setDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{
                    width: '100%', fontSize: 12, padding: '4px 8px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--surface-alt)',
                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 3 }}>Start month</label>
                <SearchableSelect
                  value={startMonth}
                  options={MONTH_SELECT_OPTS}
                  onChange={v => setStartMonth(v as MonthKey)}
                  wrapperStyle={{ width: '100%' }}
                  buttonStyle={{
                    width: '100%', fontSize: 12, padding: '4px 8px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--surface-alt)',
                    color: 'var(--text-primary)', boxSizing: 'border-box',
                  }}
                  dropdownWidth={160}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => {
                  const dates = autoFillDates(freq, day, startMonth, fy)
                  onApply(dates)
                  setOpen(false)
                }}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </td>
  )
}

/* ─── Searchable Select ───────────────────────────────────────── */

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  buttonStyle,
  wrapperStyle,
  dropdownWidth = 220,
  disabled = false,
}: {
  value: string
  options: SelectOption[]
  onChange: (val: string) => void
  placeholder?: string
  buttonStyle?: React.CSSProperties
  wrapperStyle?: React.CSSProperties
  dropdownWidth?: number
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setQ(''); return }
    setTimeout(() => searchRef.current?.focus(), 0)
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selected = options.find(o => o.value === value)
  const filtered = q
    ? options.filter(o =>
        o.label.toLowerCase().includes(q.toLowerCase()) ||
        o.description?.toLowerCase().includes(q.toLowerCase())
      )
    : options

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', ...wrapperStyle }}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return
          if (!open && ref.current) {
            const r = ref.current.getBoundingClientRect()
            setAlignRight(r.left + dropdownWidth > window.innerWidth - 8)
          }
          setOpen(o => !o)
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit', border: 'none', background: 'transparent',
          padding: 0, ...buttonStyle,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', ...(alignRight ? {right:0} : {left:0}), marginTop: 4, zIndex: 9999,
          width: dropdownWidth, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.15)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px',
              borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-alt)',
            }}>
              <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search"
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit', flex: 1, width: 0,
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 0 6px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                No results
              </div>
            ) : filtered.map(opt => {
              const active = opt.value === value
              return (
                <div
                  key={opt.value}
                  onMouseDown={() => { onChange(opt.value); setOpen(false) }}
                  style={{
                    padding: opt.description ? '7px 12px' : '8px 12px',
                    cursor: 'pointer',
                    background: active ? 'var(--brand, #0d9488)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-primary)',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-subtle, #f8fafc)'
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{opt.label}</div>
                  {opt.description && (
                    <div style={{ fontSize: 11, marginTop: 2, color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                      {opt.description}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
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
    priority: 'high', days_before_due: 7,
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
            <SearchableSelect
              value={draft.group_name}
              options={GROUP_SELECT_OPTS}
              onChange={v => set('group_name', v)}
              wrapperStyle={{ width: '100%' }}
              buttonStyle={{ ...inputStyle, display: 'flex' }}
              dropdownWidth={280}
            />
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
            <SearchableSelect
              value={draft.priority}
              options={PRIORITY_SELECT_OPTS}
              onChange={v => set('priority', v)}
              wrapperStyle={{ width: '100%' }}
              buttonStyle={{ ...inputStyle, display: 'flex' }}
              dropdownWidth={220}
            />
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

/* ─── Template Manager Modal ──────────────────────────────── */

function TemplateManageModal({
  templates,
  onClose,
  onChange,
}: {
  templates: AttachTemplate[]
  onClose: () => void
  onChange: (templates: AttachTemplate[]) => void
}) {
  const [local, setLocal] = useState<AttachTemplate[]>(
    templates.map(t => ({ ...t, items: [...t.items] }))
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName,  setEditName]  = useState('')
  const [editItems, setEditItems] = useState('')
  const [newName,   setNewName]   = useState('')
  const [newItems,  setNewItems]  = useState('')

  function startEdit(t: AttachTemplate) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditItems(t.items.join('\n'))
  }

  function commitEdit(id: string) {
    const items = editItems.split('\n').map(s => s.trim()).filter(Boolean)
    setLocal(prev => prev.map(t => t.id === id ? { ...t, name: editName.trim() || t.name, items } : t))
    setEditingId(null)
  }

  function addNew() {
    if (!newName.trim()) { return }
    const items = newItems.split('\n').map(s => s.trim()).filter(Boolean)
    const t: AttachTemplate = { id: `tmpl-${Date.now()}`, name: newName.trim(), items }
    setLocal(prev => [...prev, t])
    setNewName('')
    setNewItems('')
  }

  function del(id: string) {
    setLocal(prev => prev.filter(t => t.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) { onChange(local); onClose() } }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Attachment Templates
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Define reusable attachment sets. Select multiple templates per task to merge them.
            </p>
          </div>
          <button onClick={() => { onChange(local); onClose() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18}/>
          </button>
        </div>

        {/* Template list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
          {local.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No templates yet. Create one below.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {local.map(t => (
              <div key={t.id} style={{
                border: '1px solid var(--border)', borderRadius: 10,
                overflow: 'hidden',
              }}>
                {editingId === t.id ? (
                  <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)' }}>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Template name
                      </label>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        style={{ width: '100%', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Attachments (one per line)
                      </label>
                      <textarea
                        value={editItems}
                        onChange={e => setEditItems(e.target.value)}
                        rows={4}
                        placeholder="Computation Sheet&#10;Filed Return&#10;Acknowledgement"
                        style={{ width: '100%', fontSize: 12, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} style={btnGhost}>Cancel</button>
                      <button onClick={() => commitEdit(t.id)} style={btnPrimary}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {t.items.length === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No attachments defined</span>
                        ) : t.items.map((item, i) => (
                          <span key={i} style={{
                            fontSize: 11, padding: '1px 7px', borderRadius: 6,
                            background: 'var(--surface-subtle)', border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)',
                          }}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => startEdit(t)} title="Edit"
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Pencil size={11}/> Edit
                      </button>
                      <button onClick={() => del(t.id)} title="Delete"
                        style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: '#dc2626', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new template */}
          <div style={{ marginTop: 16, padding: '14px 16px', border: '1.5px dashed var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
              + New template
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Template name *
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. ROC Filing"
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) addNew() }}
                style={{ width: '100%', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-alt)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Attachments (one per line)
              </label>
              <textarea
                value={newItems}
                onChange={e => setNewItems(e.target.value)}
                rows={3}
                placeholder="Form MGT-7&#10;Form AOC-4&#10;Director Report"
                style={{ width: '100%', fontSize: 12, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-alt)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={addNew}
                disabled={!newName.trim()}
                style={{ ...btnPrimary, opacity: newName.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={13}/> Add template
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          <button onClick={() => { onChange(local); onClose() }} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14}/> Save templates
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
  task, editable, fy,
  onUpdate, onDelete, hasPendingChanges, onSave,
  templates, selectedTemplateIds, onTemplateSelect,
}: {
  task: CAMasterTask
  editable: boolean
  fy: string
  onUpdate: (patch: Partial<CAMasterTask>) => void
  onDelete: () => void
  hasPendingChanges: boolean
  onSave: () => Promise<void>
  templates: AttachTemplate[]
  selectedTemplateIds: string[]
  onTemplateSelect: (ids: string[]) => void
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

      {/* Template selector */}
      <TemplateSelectCell
        templates={templates}
        selectedIds={selectedTemplateIds}
        editable={editable}
        onSelect={ids => {
          onTemplateSelect(ids)
          const merged = mergeTemplateItems(ids, templates)
          onUpdate({ attachment_headers: merged, attachment_count: merged.length })
        }}
      />

      {/* Attach count — read-only, computed from selected templates */}
      <td style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: 'center' }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: task.attachment_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          minWidth: 28, display: 'inline-block',
        }}>
          {task.attachment_count > 0 ? task.attachment_count : '—'}
        </span>
      </td>

      {/* Attach headers — view-only */}
      <AttachHeadersCell
        count={task.attachment_count}
        headers={task.attachment_headers}
        editable={false}
        onSave={() => {}}
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
          <SearchableSelect
            value={task.priority}
            options={PRIORITY_SELECT_OPTS}
            onChange={v => onUpdate({ priority: v })}
            buttonStyle={{
              fontSize: 12, padding: '3px 6px', borderRadius: 999, fontWeight: 600,
              background: PRI_STYLE[task.priority]?.bg ?? '#fff',
              color: PRI_STYLE[task.priority]?.color ?? '#000',
              border: `1px solid ${PRI_STYLE[task.priority]?.border ?? '#ddd'}`,
            }}
            dropdownWidth={200}
          />
        ) : (
          <PriorityBadge value={task.priority} />
        )}
      </td>

      {/* Quick fill — now before month cells */}
      <QuickFillCell
        taskId={task.id}
        fy={fy}
        editable={editable}
        onApply={dates => onUpdate({ dates: { ...task.dates, ...dates } })}
      />

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            {hasPendingChanges && (
              <button
                onClick={onSave}
                title="Save changes"
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '3px 8px', borderRadius: 6, border: 'none',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Save size={11} /> Save
              </button>
            )}
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
          </div>
        )}
      </td>
    </tr>
  )
}

/* ─── GroupSection ────────────────────────────────────────────── */

function GroupSection({
  groupName, tasks, editable, fy,
  pendingChanges, onUpdate, onDelete, onSaveRow,
  templates, taskSel, onTemplateSelect,
}: {
  groupName: string
  tasks: CAMasterTask[]
  editable: boolean
  fy: string
  pendingChanges: Record<string, Partial<CAMasterTask>>
  onUpdate: (id: string, patch: Partial<CAMasterTask>) => void
  onDelete: (id: string) => void
  onSaveRow: (id: string) => Promise<void>
  templates: AttachTemplate[]
  taskSel: Record<string, string[]>
  onTemplateSelect: (taskId: string, ids: string[]) => void
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
          colSpan={6 + 12 + 2}
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
          fy={fy}
          onUpdate={patch => onUpdate(task.id, patch)}
          onDelete={() => onDelete(task.id)}
          hasPendingChanges={!!pendingChanges[task.id]}
          onSave={() => onSaveRow(task.id)}
          templates={templates}
          selectedTemplateIds={taskSel[task.id] ?? []}
          onTemplateSelect={ids => onTemplateSelect(task.id, ids)}
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
  const [triggering,      setTriggering]      = useState(false)
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(GROUP_FILTER_ALL)
  const [search, setSearch] = useState('')
  const [savedTab, setSavedTab] = useState<'unsaved' | 'saved'>('unsaved')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<CAMasterTask>>>({})
  const [savingAll, setSavingAll] = useState(false)
  // Tracks server-confirmed task values (before any pending edits)
  const originalValuesRef = useRef<Record<string, CAMasterTask>>({})
  // CSV import state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFy,        setImportFy]        = useState<string>('2026-27')
  const [importFile,      setImportFile]      = useState<File | null>(null)
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<{
    imported: number; skipped: number; errors: string[]
  } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Propagation modal state
  const [propagateModal, setPropagateModal] = useState<{
    old_name: string
    fields: {
      title?: string
      priority?: string
      attachment_headers?: { old: string[]; new: string[] }
    }
  } | null>(null)
  const [propagating, setPropagating] = useState(false)

  // Attachment templates
  const [attTemplates,       setAttTemplates]       = useState<AttachTemplate[]>(() => loadAttTemplates())
  const [taskSel,            setTaskSel]            = useState<Record<string, string[]>>(() => loadTaskSel())
  const [showManageTemplates, setShowManageTemplates] = useState(false)

  function handleTemplateChange(templates: AttachTemplate[]) {
    setAttTemplates(templates)
    saveAttTemplates(templates)
  }

  function handleTaskTemplateSelect(taskId: string, ids: string[]) {
    const next = { ...taskSel, [taskId]: ids }
    setTaskSel(next)
    saveTaskSel(next)
  }

  // is_user_saved is now stored in the DB column — read from task.is_user_saved

  const canEdit = isAdmin(userRole)

  /* ── Fetch ── */
  const fetchTasks = useCallback(async (year: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ca/master?fy=${encodeURIComponent(year)}`)
      const json = (await res.json()) as { data?: CAMasterTask[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setTasks(json.data ?? [])
      // Store server-confirmed values so we can detect what changed on save
      originalValuesRef.current = {}
      ;(json.data ?? []).forEach(t => { originalValuesRef.current[t.id] = { ...t } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks(fy) }, [fy, fetchTasks])

  /* ── Manually trigger compliance task spawn ── */
  async function handleTriggerSpawn() {
    setTriggering(true)
    try {
      const res = await fetch('/api/ca/trigger', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Trigger failed')
      if (json.errors?.length) {
        toast.error(`${json.spawned} spawned, but errors: ${json.errors[0]}`)
      } else {
        toast.success(json.message ?? `Spawned ${json.spawned} compliance task(s) ✓`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trigger failed')
    } finally {
      setTriggering(false)
    }
  }

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

  /* ── CSV template download (client-side blob) ── */
  function downloadTemplate() {
    const HEADERS = [
      'code','name','group_name','task_type','priority','days_before_due','attachment_count',
      'due_apr','due_may','due_jun','due_jul','due_aug','due_sep',
      'due_oct','due_nov','due_dec','due_jan','due_feb','due_mar',
      'attachment_1','attachment_2','attachment_3','attachment_4','attachment_5',
      'attachment_6','attachment_7','attachment_8','attachment_9','attachment_10',
    ]
    const EXAMPLES = [
      ['GST-001','GSTR 1 (Monthly)','GST','Monthly','medium','7','2',
       '2026-05-11','2026-06-11','2026-07-11','2026-08-11','2026-09-11','2026-10-11',
       '2026-11-11','2026-12-11','2027-01-11','2027-02-11','2027-03-11','',
       'Computation','Return','','','','','','','',''],
      ['TDS-001','TDS Return Q1','TDS / TCS','Quarterly','medium','14','3',
       '','','','2026-07-31','','','','2026-10-31','','2027-01-31','','2027-05-31',
       'Computation','Challan','Return','','','','','','',''],
      ['IT-001','Advance Tax - Q1','Income Tax','Quarterly','high','7','1',
       '','','2026-06-15','','','','','','','','','',
       'Challan','','','','','','','','',''],
    ]
    const csv = [HEADERS, ...EXAMPLES].map(r => r.map(v => v.includes(',') ? `"${v}"` : v).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ca-master-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /* ── CSV import ── */
  async function handleImportCSV() {
    if (!importFile) { toast.error('Select a CSV file first'); return }
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('csv', importFile)
      fd.append('financial_year', importFy)
      const res  = await fetch('/api/ca/import-csv', { method: 'POST', body: fd })
      const json = await res.json() as { imported?: number; skipped?: number; errors?: string[]; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Import failed')
        setImportResult({ imported: 0, skipped: 0, errors: json.errors ?? [json.error ?? 'Unknown error'] })
        return
      }
      setImportResult({ imported: json.imported ?? 0, skipped: json.skipped ?? 0, errors: json.errors ?? [] })
      toast.success(`Imported ${json.imported} task${json.imported === 1 ? '' : 's'} ✓`)
      // Reload the task list if we imported for the currently viewed FY
      if (importFy === fy) await fetchTasks(fy)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  /* ── Pending change tracking (no API call until explicit save) ── */
  function handleUpdate(id: string, patch: Partial<CAMasterTask>) {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t))
    setPendingChanges(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...patch },
    }))
  }

  async function handleSaveRow(id: string) {
    // Always include is_user_saved: true so the DB tracks this (not localStorage)
    let patch: Record<string, unknown> = { ...(pendingChanges[id] ?? {}), is_user_saved: true }
    const original = originalValuesRef.current[id]

    // Re-compute attachment_headers from current template selections so that
    // template ITEM edits (which don't change selection IDs) also trigger
    // the propagation modal.
    const selectedIds = taskSel[id] ?? []
    if (selectedIds.length > 0) {
      const recomputed = mergeTemplateItems(selectedIds, attTemplates)
      const oldH = original?.attachment_headers ?? []
      if (JSON.stringify(recomputed) !== JSON.stringify(oldH)) {
        patch = { ...patch, attachment_headers: recomputed, attachment_count: recomputed.length }
        setTasks(ts => ts.map(t => t.id === id ? { ...t, attachment_headers: recomputed, attachment_count: recomputed.length } : t))
      }
    }

    const prev = tasks.find(t => t.id === id)
    try {
      const res = await fetch(`/api/ca/master/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = (await res.json()) as { data?: CAMasterTask; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
      setPendingChanges(p => { const n = { ...p }; delete n[id]; return n })
      setTasks(ts => ts.map(t => t.id === id ? { ...t, is_user_saved: true } : t))
      // Update our baseline so next save compares against fresh values
      if (original) originalValuesRef.current[id] = { ...original, ...patch }
      toast.success('Task saved')

      // Check if any propagation-relevant fields changed
      if (original) {
        const propFields: { title?: string; priority?: string; attachment_headers?: { old: string[]; new: string[] } } = {}
        if (patch.name && patch.name !== original.name) propFields.title = patch.name as string
        if (patch.priority && patch.priority !== original.priority) propFields.priority = patch.priority as string
        if (patch.attachment_headers) {
          const oldH = original.attachment_headers ?? []
          const newH = patch.attachment_headers as string[]
          if (JSON.stringify(oldH) !== JSON.stringify(newH)) {
            propFields.attachment_headers = { old: oldH, new: newH }
          }
        }
        if (Object.keys(propFields).length > 0) {
          setPropagateModal({ old_name: original.name, fields: propFields })
        }
      }
    } catch (err) {
      if (prev) setTasks(ts => ts.map(t => t.id === id ? prev : t))
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleSaveAll() {
    const ids = Object.keys(pendingChanges)
    if (ids.length === 0) return
    setSavingAll(true)

    // Snapshot current tasks for rollback on failure
    const prevTasks = tasks

    // Compute effective patch for every pending id (mirrors handleSaveRow logic)
    type PropEntry = { old_name: string; fields: NonNullable<typeof propagateModal>['fields'] }
    const rows: Array<{ id: string; [key: string]: unknown }> = []
    const propagationQueue: PropEntry[] = []

    for (const id of ids) {
      // Always include is_user_saved: true so DB tracks it (not localStorage)
      let patch: Record<string, unknown> = { ...(pendingChanges[id] ?? {}), is_user_saved: true }
      const original = originalValuesRef.current[id]

      // Re-compute attachment_headers from current template selections
      const selectedIds = taskSel[id] ?? []
      if (selectedIds.length > 0) {
        const recomputed = mergeTemplateItems(selectedIds, attTemplates)
        const oldH = original?.attachment_headers ?? []
        if (JSON.stringify(recomputed) !== JSON.stringify(oldH)) {
          patch = { ...patch, attachment_headers: recomputed, attachment_count: recomputed.length }
          setTasks(ts => ts.map(t => t.id === id ? { ...t, attachment_headers: recomputed, attachment_count: recomputed.length } : t))
        }
      }

      rows.push({ id, ...patch })

      // Collect propagation-relevant changes
      if (original) {
        const propFields: NonNullable<typeof propagateModal>['fields'] = {}
        if (patch.name && patch.name !== original.name) propFields.title = patch.name as string
        if (patch.priority && patch.priority !== original.priority) propFields.priority = patch.priority as string
        if (patch.attachment_headers) {
          const oldH = original.attachment_headers ?? []
          const newH = patch.attachment_headers as string[]
          if (JSON.stringify(oldH) !== JSON.stringify(newH)) {
            propFields.attachment_headers = { old: oldH, new: newH }
          }
        }
        if (Object.keys(propFields).length > 0) {
          propagationQueue.push({ old_name: original.name, fields: propFields })
        }
      }
    }

    if (rows.length === 0) { setSavingAll(false); return }

    try {
      const res = await fetch('/api/ca/master/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const json = await res.json() as { saved: number; failed: number; errors: Array<{ id: string; error: string }> }
      if (!res.ok) throw new Error('Bulk save failed')

      const failedIdSet = new Set((json.errors ?? []).map(e => e.id))
      const savedRowIds = rows.filter(r => !failedIdSet.has(r.id as string)).map(r => r.id as string)

      // Clear pending changes for saved rows and mark them saved in state
      setPendingChanges(prev => {
        const next = { ...prev }
        savedRowIds.forEach(id => delete next[id])
        return next
      })
      const savedSet = new Set(savedRowIds)
      setTasks(ts => ts.map(t => savedSet.has(t.id) ? { ...t, is_user_saved: true } : t))

      // Advance baselines so the next save compares against fresh values
      savedRowIds.forEach(id => {
        const row = rows.find(r => r.id === id)
        if (row && originalValuesRef.current[id]) {
          const { id: _id, ...fields } = row
          originalValuesRef.current[id] = { ...originalValuesRef.current[id], ...fields } as typeof originalValuesRef.current[string]
        }
      })

      if (json.saved > 0) toast.success(`${json.saved} task${json.saved !== 1 ? 's' : ''} saved`)
      if (json.failed > 0) toast.error(`${json.failed} task${json.failed !== 1 ? 's' : ''} failed to save`)

      // Show first propagation modal (if any saved row triggered it)
      if (propagationQueue.length > 0) {
        setPropagateModal(propagationQueue[0])
      }
    } catch (err) {
      setTasks(prevTasks)
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingAll(false)
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

  /* ── Propagate changes to existing tasks ── */
  async function handlePropagate() {
    if (!propagateModal) return
    setPropagating(true)
    try {
      const res = await fetch('/api/ca/propagate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_name: propagateModal.old_name,
          fields: propagateModal.fields,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Propagation failed')
      toast.success(`Updated ${json.updated} pending task${json.updated !== 1 ? 's' : ''}`)
      setPropagateModal(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Propagation failed')
    } finally {
      setPropagating(false)
    }
  }

  /* ── Grouped + filtered tasks ── */
  const { grouped, searchedUnsavedCount, searchedSavedCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    // First apply only search (no tab filter) to get accurate tab counts
    const searchFiltered = tasks.filter(t => {
      if (groupFilter !== GROUP_FILTER_ALL && t.group_name !== groupFilter) return false
      if (!q) return true
      return t.name.toLowerCase().includes(q) || t.group_name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    })
    const searchedSavedCount   = searchFiltered.filter(t => t.is_user_saved).length
    const searchedUnsavedCount = searchFiltered.filter(t => !t.is_user_saved).length

    // Then apply tab filter
    const filtered = searchFiltered.filter(t => {
      if (savedTab === 'saved'   && !t.is_user_saved) return false
      if (savedTab === 'unsaved' &&  t.is_user_saved) return false
      return true
    })
    const map = new Map<string, CAMasterTask[]>()
    for (const t of filtered) {
      if (!map.has(t.group_name)) map.set(t.group_name, [])
      map.get(t.group_name)!.push(t)
    }
    return { grouped: map, searchedUnsavedCount, searchedSavedCount }
  }, [tasks, groupFilter, search, savedTab])

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
          <SearchableSelect
            value={fy}
            options={FY_SELECT_OPTS}
            onChange={v => setFy(v as FYOption)}
            buttonStyle={{
              fontSize: 14, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface-alt)',
              color: 'var(--text-primary)',
            }}
            dropdownWidth={160}
          />
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
            onClick={() => { setImportResult(null); setImportFile(null); setImportFy(fy); setShowImportModal(true) }}
            style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <UploadCloud size={14} />
            Import CSV
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => setShowManageTemplates(true)}
            style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Paperclip size={14}/>
            Manage Templates
          </button>
        )}

        {canEdit && (
          <button
            onClick={handleTriggerSpawn}
            disabled={triggering}
            title="Create tasks now for all assigned clients whose trigger date has passed"
            style={{
              ...btnGhost,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: triggering ? 0.7 : 1,
              borderColor: '#0d9488', color: '#0d9488',
            }}
          >
            <AlertCircle size={14} />
            {triggering ? 'Spawning…' : 'Spawn tasks now'}
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

        {Object.keys(pendingChanges).length > 0 && (
          <button
            onClick={handleSaveAll}
            disabled={savingAll}
            style={{
              ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6,
              background: '#0d9488', opacity: savingAll ? 0.7 : 1,
            }}
          >
            <Save size={14} />
            {savingAll ? 'Saving…' : `Bulk Save (${Object.keys(pendingChanges).length})`}
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

      {/* ── Search + Saved/Pending tabs ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 200px', minWidth: 160, maxWidth: 320,
          padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface-alt)',
        }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>

        {/* Unsaved / Saved tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
          {([
            { key: 'unsaved', label: 'Unsaved', count: searchedUnsavedCount, color: '#ca8a04' },
            { key: 'saved',   label: 'Saved',   count: searchedSavedCount,   color: '#0d9488' },
          ] as const).map(tab => {
            const active = savedTab === tab.key
            return (
              <button key={tab.key} onClick={() => setSavedTab(tab.key)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: active ? 700 : 500,
                  border: 'none',
                  background: active ? tab.color : 'var(--surface-alt)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.12s',
                }}>
                {tab.label}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: active ? '#fff' : 'var(--text-muted)',
                }}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
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
                  <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 4, minWidth: 200, textAlign: 'left', background: 'var(--surface-alt)', borderRight: '1px solid var(--border-light)' }}>
                    Task name
                  </th>
                  <th style={{ ...thStyle, minWidth: 150 }}>Templates</th>
                  <th style={{ ...thStyle, minWidth: 60 }}>Attach#</th>
                  <th style={{ ...thStyle, minWidth: 100 }} title="Attachment headers">
                    <Paperclip size={12} />
                  </th>
                  <th style={{ ...thStyle, minWidth: 68 }}>Days before</th>
                  <th style={{ ...thStyle, minWidth: 90 }}>Priority</th>
                  <th style={{ ...thStyle, minWidth: 32, width: 32 }} title="Quick fill dates" />
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
                    fy={fy}
                    pendingChanges={pendingChanges}
                    onUpdate={handleUpdate}
                    onDelete={requestDelete}
                    onSaveRow={handleSaveRow}
                    templates={attTemplates}
                    taskSel={taskSel}
                    onTemplateSelect={handleTaskTemplateSelect}
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

      {/* ── Attachment Templates Manager ── */}
      {showManageTemplates && (
        <TemplateManageModal
          templates={attTemplates}
          onClose={() => setShowManageTemplates(false)}
          onChange={handleTemplateChange}
        />
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

      {/* ── CSV Import modal ── */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !importing && setShowImportModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 14, padding: 28,
            width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-light, #f0fdf4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UploadCloud size={18} style={{ color: 'var(--brand, #0d9488)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Import CA Master from CSV</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Upserts tasks — existing codes are updated, new ones are created</div>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} disabled={importing}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Download template */}
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Download the template first</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fill it in and upload below</div>
                </div>
              </div>
              <button onClick={downloadTemplate}
                style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 12 }}>
                <Download size={13} /> Template
              </button>
            </div>

            {/* Financial year selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                Financial Year
              </label>
              <SearchableSelect
                value={importFy}
                options={FY_SELECT_OPTS}
                onChange={setImportFy}
                wrapperStyle={{ width: '100%' }}
                buttonStyle={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
                }}
                dropdownWidth={200}
              />
            </div>

            {/* File picker */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                CSV File
              </label>
              <div
                onClick={() => importFileRef.current?.click()}
                style={{
                  border: `2px dashed ${importFile ? 'var(--brand, #0d9488)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '18px 16px', cursor: 'pointer', textAlign: 'center',
                  background: importFile ? 'var(--brand-light, #f0fdf4)' : 'var(--surface-subtle)',
                  transition: 'all 0.15s',
                }}>
                {importFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <FileText size={16} style={{ color: 'var(--brand, #0d9488)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand, #0d9488)' }}>{importFile.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({(importFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div>
                    <UploadCloud size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 6px' }} />
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Click to select your CSV file</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>or drag and drop here</div>
                  </div>
                )}
                <input ref={importFileRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null) }} />
              </div>
            </div>

            {/* Result panel */}
            {importResult && (
              <div style={{
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                background: importResult.errors.length && importResult.imported === 0 ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${importResult.errors.length && importResult.imported === 0 ? '#fecaca' : '#bbf7d0'}`,
              }}>
                {importResult.imported > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: importResult.errors.length ? 6 : 0 }}>
                    ✓ {importResult.imported} task{importResult.imported !== 1 ? 's' : ''} imported
                    {importResult.skipped > 0 && `, ${importResult.skipped} row${importResult.skipped !== 1 ? 's' : ''} skipped`}
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                      {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} had errors:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#dc2626' }}>
                      {importResult.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                      {importResult.errors.length > 8 && <li>…and {importResult.errors.length - 8} more</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImportModal(false)} disabled={importing} style={btnGhost}>
                {importResult?.imported ? 'Close' : 'Cancel'}
              </button>
              <button
                onClick={handleImportCSV}
                disabled={!importFile || importing}
                style={{
                  ...btnPrimary,
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: !importFile || importing ? 0.6 : 1,
                  cursor: !importFile || importing ? 'not-allowed' : 'pointer',
                }}>
                {importing
                  ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</>
                  : <><UploadCloud size={14} /> Import</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Propagate changes modal ── */}
      {propagateModal && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.35)',
          display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => !propagating && setPropagateModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:14,
            padding:28, minWidth:380, maxWidth:460, boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
            border:'1px solid var(--border)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>
              Apply changes to pending tasks?
            </div>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 16px' }}>
              Update all incomplete tasks spawned from <strong>"{propagateModal.old_name}"</strong> across all clients:
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {propagateModal.fields.title && (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12,
                  padding:'7px 12px', borderRadius:8, background:'var(--surface-subtle)',
                  border:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-muted)', width:110 }}>Task name</span>
                  <span style={{ fontWeight:600, color:'var(--text-primary)' }}>"{propagateModal.fields.title}"</span>
                </div>
              )}
              {propagateModal.fields.priority && (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12,
                  padding:'7px 12px', borderRadius:8, background:'var(--surface-subtle)',
                  border:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-muted)', width:110 }}>Priority</span>
                  <span style={{ fontWeight:600, color:'var(--text-primary)', textTransform:'capitalize' }}>{propagateModal.fields.priority}</span>
                </div>
              )}
              {propagateModal.fields.attachment_headers && (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12,
                  padding:'7px 12px', borderRadius:8, background:'var(--surface-subtle)',
                  border:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-muted)', width:110 }}>Attachments</span>
                  <span style={{ fontWeight:600, color:'var(--text-primary)' }}>Rename document subtasks</span>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setPropagateModal(null)} disabled={propagating}
                style={{ padding:'8px 18px', borderRadius:8, border:'1px solid var(--border)',
                  background:'var(--surface)', color:'var(--text-secondary)', fontSize:13,
                  cursor:propagating ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                Skip
              </button>
              <button onClick={handlePropagate} disabled={propagating}
                style={{ padding:'8px 20px', borderRadius:8, border:'none',
                  background:'var(--brand)', color:'#fff', fontSize:13, fontWeight:600,
                  cursor:propagating ? 'not-allowed' : 'pointer', fontFamily:'inherit',
                  opacity: propagating ? 0.7 : 1 }}>
                {propagating ? 'Updating…' : 'Yes, update pending tasks'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', fontWeight: 600, fontSize: 12,
  color: 'var(--text-secondary)', textAlign: 'left',
  whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
}
