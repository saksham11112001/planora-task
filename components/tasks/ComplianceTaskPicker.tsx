'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, ChevronRight, FileCheck, X } from 'lucide-react'
import { COMPLIANCE_TASKS, COMPLIANCE_GROUPS, type ComplianceTask } from '@/lib/data/complianceTasks'

interface Props {
  onSelect: (task: ComplianceTask) => void
  disabled?: boolean
}

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

export function ComplianceTaskPicker({ onSelect, disabled }: Props) {
  const [open,        setOpen]        = useState(false)
  const [search,      setSearch]      = useState('')
  const [expandedGrp, setExpandedGrp] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = search.toLowerCase().trim()
  const filtered = q
    ? COMPLIANCE_TASKS.filter(t => t.title.toLowerCase().includes(q) || t.group.toLowerCase().includes(q))
    : null

  function pick(task: ComplianceTask) {
    onSelect(task)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        title="Pick from CA compliance template"
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
          borderRadius: 20, border: '1px solid #0d9488',
          background: open ? 'rgba(13,148,136,0.12)' : 'rgba(13,148,136,0.07)',
          color: '#0d9488', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}>
        <FileCheck style={{ width: 12, height: 12, flexShrink: 0 }}/>
        CA Compliance
        <ChevronDown style={{ width: 11, height: 11, opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}/>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}/>
          <div style={{
            position: 'absolute', left: 0, top: 'calc(100% + 6px)',
            width: 360, maxHeight: 440, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>CA Compliance Tasks</span>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <X style={{ width: 13, height: 13 }}/>
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px',
                borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
                <Search style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }}/>
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search GSTR, ITR, TDS, ROC…"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X style={{ width: 11, height: 11, color: 'var(--text-muted)' }}/>
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered ? (
                // Search results — flat list
                filtered.length === 0 ? (
                  <p style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    No tasks match "{search}"
                  </p>
                ) : (
                  filtered.map(task => (
                    <TaskRow key={task.title} task={task} onPick={pick}/>
                  ))
                )
              ) : (
                // Grouped view
                COMPLIANCE_GROUPS.map(group => {
                  const groupTasks = COMPLIANCE_TASKS.filter(t => t.group === group)
                  if (groupTasks.length === 0) return null
                  const isOpen = expandedGrp === group
                  const color  = GROUP_COLORS[group] ?? '#455A64'
                  return (
                    <div key={group}>
                      <button
                        onClick={() => setExpandedGrp(isOpen ? null : group)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: isOpen ? `${color}12` : 'transparent',
                          border: 'none', borderBottom: '1px solid var(--border-light)',
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          transition: 'background 0.1s' }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }}/>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{group}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{groupTasks.length}</span>
                        {isOpen
                          ? <ChevronDown style={{ width: 12, height: 12, color: 'var(--text-muted)' }}/>
                          : <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-muted)' }}/>
                        }
                      </button>
                      {isOpen && groupTasks.map(task => (
                        <TaskRow key={task.title} task={task} onPick={pick} indent/>
                      ))}
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border-light)',
              fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-subtle)' }}>
              {COMPLIANCE_TASKS.length} tasks · Subtasks & attachments auto-filled from Sachit's template
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TaskRow({ task, onPick, indent }: { task: ComplianceTask; onPick: (t: ComplianceTask) => void; indent?: boolean }) {
  const priColor = task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#ca8a04' : '#16a34a'
  return (
    <button
      onClick={() => onPick(task)}
      style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: `7px 12px 7px ${indent ? 24 : 12}px`,
        background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--brand-light)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
          {task.title}
        </p>
        {task.subtasks.length > 0 && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.3 }}>
            📎 {task.subtasks.map(s => s.title).join(' · ')}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: priColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {task.priority}
        </span>
        {task.subtasks.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface-subtle)',
            padding: '1px 5px', borderRadius: 99 }}>
            {task.subtasks.length} subtask{task.subtasks.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  )
}
