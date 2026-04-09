'use client'
import React, { useState } from 'react'
import { useFilterStore } from '@/store/appStore'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'

/* ── Date helpers ── */
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function subDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const DUE_PRESETS = [
  { value: '1d',   label: 'Due in 1 day',  from: () => todayIso(), to: () => addDays(1)  },
  { value: '3d',   label: 'Due in 3 days', from: () => todayIso(), to: () => addDays(3)  },
  { value: '1w',   label: 'Due in 1 week', from: () => todayIso(), to: () => addDays(7)  },
  { value: '15d',  label: 'Due in 15 days',from: () => todayIso(), to: () => addDays(15) },
  { value: 'custom', label: 'Custom range…', from: () => '', to: () => '' },
] as const

const CREATED_PRESETS = [
  { value: 'today',  label: 'Today',         from: () => todayIso(),  to: () => todayIso()  },
  { value: '7d',     label: 'Last 7 days',   from: () => subDays(7),  to: () => todayIso()  },
  { value: '30d',    label: 'Last 30 days',  from: () => subDays(30), to: () => todayIso()  },
  { value: '90d',    label: 'Last 90 days',  from: () => subDays(90), to: () => todayIso()  },
  { value: 'custom', label: 'Custom range…', from: () => '',          to: () => ''          },
] as const

const UPDATED_PRESETS = [
  { value: 'today',  label: 'Today',         from: () => todayIso(),  to: () => todayIso()  },
  { value: '7d',     label: 'Last 7 days',   from: () => subDays(7),  to: () => todayIso()  },
  { value: '30d',    label: 'Last 30 days',  from: () => subDays(30), to: () => todayIso()  },
  { value: '90d',    label: 'Last 90 days',  from: () => subDays(90), to: () => todayIso()  },
  { value: 'custom', label: 'Custom range…', from: () => '',          to: () => ''          },
] as const

interface Props {
  clients?:          { id: string; name: string; color: string }[]
  members?:          { id: string; name: string }[]
  showSearch?:       boolean
  showPriority?:     boolean
  showStatus?:       boolean
  showDueDate?:      boolean
  showAssignee?:     boolean
  showAssignor?:     boolean
  showCreatedDate?:  boolean
  showUpdatedDate?:  boolean
  className?:        string
}

/* ---------- tiny helpers ---------- */
const PILL: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '4px 10px', borderRadius: 20, fontSize: 12,
  cursor: 'pointer', outline: 'none', border: '1px solid var(--border)',
  background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
  fontFamily: 'inherit', appearance: 'none' as any, whiteSpace: 'nowrap' as any,
}
const PILL_ACTIVE: React.CSSProperties = {
  ...PILL,
  border: '1px solid var(--brand)',
  background: 'rgba(13,148,136,0.08)',
  color: 'var(--brand)',
  fontWeight: 600,
}

function PillSelect({
  value, onChange, placeholder, options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
}) {
  const active = !!value
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...(active ? PILL_ACTIVE : PILL), paddingRight: 24 }}
      >
        <option value=''>{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {active && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, borderRadius: '50%', border: 'none',
            background: 'var(--brand)', color: '#fff',
            fontSize: 9, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, padding: 0,
          }}
          title="Clear"
        >×</button>
      )}
    </div>
  )
}

export function UniversalFilterBar({
  clients = [],
  members = [],
  showSearch        = false,
  showPriority      = true,
  showStatus        = true,
  showDueDate       = false,
  showAssignee      = false,
  showAssignor      = false,
  showCreatedDate   = false,
  showUpdatedDate   = false,
}: Props) {
  const {
    search, clientId, priority, status, assigneeId, creatorId,
    dueDateFrom, dueDateTo,
    createdFrom, createdTo,
    updatedFrom, updatedTo,
    setFilter, resetFilters,
  } = useFilterStore()
  const [duePreset,     setDuePreset]     = useState<string>('')
  const [showCustomDue, setShowCustomDue] = useState(false)
  const [createdPreset, setCreatedPreset] = useState<string>('')
  const [showCustomCreated, setShowCustomCreated] = useState(false)
  const [updatedPreset, setUpdatedPreset] = useState<string>('')
  const [showCustomUpdated, setShowCustomUpdated] = useState(false)

  const activeCount = [
    clientId, priority, status, assigneeId, creatorId,
    dueDateFrom, dueDateTo, duePreset,
    createdFrom, createdTo, createdPreset,
    updatedFrom, updatedTo, updatedPreset,
    search,
  ].filter(Boolean).length

  const priorityOpts = (Object.keys(PRIORITY_CONFIG) as string[])
    .filter(k => k !== 'none')
    .map(k => ({ value: k, label: PRIORITY_CONFIG[k as keyof typeof PRIORITY_CONFIG].label }))

  const statusOpts = (Object.keys(STATUS_CONFIG) as string[])
    .map(k => ({ value: k, label: STATUS_CONFIG[k as keyof typeof STATUS_CONFIG].label }))

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
      borderBottom: '1px solid var(--border-light)', background: 'var(--surface)',
      flexShrink: 0, flexWrap: 'wrap', overflowX: 'auto',
    }}>
      {/* Search */}
      {showSearch && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '4px 10px', minWidth: 160, flex: '1 1 160px', maxWidth: 240,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder="Search…"
            style={{
              flex: 1, fontSize: 12, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
          {search && (
            <button onClick={() => setFilter('search', '')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: 0 }}>
              ×
            </button>
          )}
        </div>
      )}

      {/* Client */}
      {clients.length > 0 && (
        <PillSelect
          value={clientId}
          onChange={v => setFilter('clientId', v)}
          placeholder="All clients"
          options={clients.map(c => ({ value: c.id, label: c.name }))}
        />
      )}

      {/* Priority */}
      {showPriority && (
        <PillSelect
          value={priority}
          onChange={v => setFilter('priority', v)}
          placeholder="All priorities"
          options={priorityOpts}
        />
      )}

      {/* Status */}
      {showStatus && (
        <PillSelect
          value={status}
          onChange={v => setFilter('status', v)}
          placeholder="All statuses"
          options={statusOpts}
        />
      )}

      {/* Assignee */}
      {showAssignee && members.length > 0 && (
        <PillSelect
          value={assigneeId}
          onChange={v => setFilter('assigneeId', v)}
          placeholder="All assignees"
          options={members.map(m => ({ value: m.id, label: m.name }))}
        />
      )}

      {/* Assignor (creator / assigned by) */}
      {showAssignor && members.length > 0 && (
        <PillSelect
          value={creatorId}
          onChange={v => setFilter('creatorId', v)}
          placeholder="Assigned by"
          options={members.map(m => ({ value: m.id, label: m.name }))}
        />
      )}

      {/* Due date — preset dropdown */}
      {showDueDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={duePreset}
              onChange={e => {
                const v = e.target.value
                setDuePreset(v)
                if (v === '') {
                  setFilter('dueDateFrom', '')
                  setFilter('dueDateTo', '')
                  setShowCustomDue(false)
                } else if (v === 'custom') {
                  setShowCustomDue(true)
                } else {
                  const preset = DUE_PRESETS.find(p => p.value === v)
                  if (preset) {
                    setFilter('dueDateFrom', preset.from())
                    setFilter('dueDateTo', preset.to())
                  }
                  setShowCustomDue(false)
                }
              }}
              style={{ ...(duePreset ? PILL_ACTIVE : PILL), paddingRight: 24 }}
            >
              <option value=''>Due date</option>
              {DUE_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {duePreset && (
              <button
                onClick={() => {
                  setDuePreset('')
                  setShowCustomDue(false)
                  setFilter('dueDateFrom', '')
                  setFilter('dueDateTo', '')
                }}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 14, height: 14, borderRadius: '50%', border: 'none',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, padding: 0,
                }}
                title="Clear"
              >×</button>
            )}
          </div>
          {showCustomDue && (
            <>
              <input
                type="date" value={dueDateFrom}
                onChange={e => setFilter('dueDateFrom', e.target.value)}
                style={{ ...(dueDateFrom ? PILL_ACTIVE : PILL), paddingRight: 8, fontSize: 11 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
              <input
                type="date" value={dueDateTo}
                onChange={e => setFilter('dueDateTo', e.target.value)}
                style={{ ...(dueDateTo ? PILL_ACTIVE : PILL), paddingRight: 8, fontSize: 11 }}
              />
            </>
          )}
        </div>
      )}

      {/* Created date — preset dropdown */}
      {showCreatedDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={createdPreset}
              onChange={e => {
                const v = e.target.value
                setCreatedPreset(v)
                if (v === '') {
                  setFilter('createdFrom', '')
                  setFilter('createdTo', '')
                  setShowCustomCreated(false)
                } else if (v === 'custom') {
                  setShowCustomCreated(true)
                } else {
                  const preset = CREATED_PRESETS.find(p => p.value === v)
                  if (preset) {
                    setFilter('createdFrom', preset.from())
                    setFilter('createdTo', preset.to())
                  }
                  setShowCustomCreated(false)
                }
              }}
              style={{ ...(createdPreset ? PILL_ACTIVE : PILL), paddingRight: 24 }}
            >
              <option value=''>Created date</option>
              {CREATED_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {createdPreset && (
              <button
                onClick={() => {
                  setCreatedPreset('')
                  setShowCustomCreated(false)
                  setFilter('createdFrom', '')
                  setFilter('createdTo', '')
                }}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 14, height: 14, borderRadius: '50%', border: 'none',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, padding: 0,
                }}
                title="Clear"
              >×</button>
            )}
          </div>
          {showCustomCreated && (
            <>
              <input
                type="date" value={createdFrom}
                onChange={e => setFilter('createdFrom', e.target.value)}
                style={{ ...(createdFrom ? PILL_ACTIVE : PILL), paddingRight: 8, fontSize: 11 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
              <input
                type="date" value={createdTo}
                onChange={e => setFilter('createdTo', e.target.value)}
                style={{ ...(createdTo ? PILL_ACTIVE : PILL), paddingRight: 8, fontSize: 11 }}
              />
            </>
          )}
        </div>
      )}

      {/* Last modified date — preset dropdown */}
      {showUpdatedDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={updatedPreset}
              onChange={e => {
                const v = e.target.value
                setUpdatedPreset(v)
                if (v === '') {
                  setFilter('updatedFrom', '')
                  setFilter('updatedTo', '')
                  setShowCustomUpdated(false)
                } else if (v === 'custom') {
                  setShowCustomUpdated(true)
                } else {
                  const preset = UPDATED_PRESETS.find(p => p.value === v)
                  if (preset) {
                    setFilter('updatedFrom', preset.from())
                    setFilter('updatedTo', preset.to())
                  }
                  setShowCustomUpdated(false)
                }
              }}
              style={{ ...(updatedPreset ? PILL_ACTIVE : PILL), paddingRight: 24 }}
            >
              <option value=''>Modified date</option>
              {UPDATED_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {updatedPreset && (
              <button
                onClick={() => {
                  setUpdatedPreset('')
                  setShowCustomUpdated(false)
                  setFilter('updatedFrom', '')
                  setFilter('updatedTo', '')
                }}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 14, height: 14, borderRadius: '50%', border: 'none',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, padding: 0,
                }}
                title="Clear"
              >×</button>
            )}
          </div>
          {showCustomUpdated && (
            <>
              <input
                type="date" value={updatedFrom}
                onChange={e => setFilter('updatedFrom', e.target.value)}
                style={{ ...(updatedFrom ? PILL_ACTIVE : PILL), paddingRight: 8, fontSize: 11 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
              <input
                type="date" value={updatedTo}
                onChange={e => setFilter('updatedTo', e.target.value)}
                style={{ ...(updatedTo ? PILL_ACTIVE : PILL), paddingRight: 8, fontSize: 11 }}
              />
            </>
          )}
        </div>
      )}

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={() => {
            resetFilters()
            setDuePreset(''); setShowCustomDue(false)
            setCreatedPreset(''); setShowCustomCreated(false)
            setUpdatedPreset(''); setShowCustomUpdated(false)
          }}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            border: '1px solid #dc2626', background: 'rgba(220,38,38,0.06)',
            color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' as any,
          }}
        >
          <span style={{ fontSize: 10 }}>✕</span>
          Clear all
          <span style={{
            background: '#dc2626', color: '#fff', borderRadius: '50%',
            width: 16, height: 16, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 10, fontWeight: 700,
          }}>{activeCount}</span>
        </button>
      )}
    </div>
  )
}
