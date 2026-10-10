'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertCircle, RefreshCw, Clock, CheckCircle2, Download } from 'lucide-react'
import { toast } from '@/store/appStore'
import { csvCell } from '@/lib/utils/csv'

type Status = 'present' | 'before_start' | 'after_end' | 'not_due_yet' | 'missed'

interface MissedRow {
  client: string; group: string; task: string
  due_date: string; month_key: string
  status: Status
  recoverable: boolean
}

interface Report {
  today:  string
  counts: Record<Status, number>
  total:  number
  missed: MissedRow[]
}

export default function MissedTasksView({ canSpawn }: { canSpawn: boolean }) {
  const [report, setReport]   = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [spawning, setSpawning] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const r = await fetch('/api/ca/missed')
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? 'Could not load the report')
      }
      setReport(await r.json())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load the report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function spawnNow() {
    if (spawning) return
    setSpawning(true)
    try {
      const r = await fetch('/api/ca/trigger', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error ?? 'Spawn failed'); return }
      toast.success(`Created ${j.spawned ?? 0} task${j.spawned === 1 ? '' : 's'}`)
      await load(true)
    } catch {
      toast.error('Spawn failed')
    } finally {
      setSpawning(false)
    }
  }

  function exportCSV() {
    if (!report?.missed.length) { toast.error('Nothing to export'); return }
    const rows = [
      ['Client', 'Group', 'Task', 'Due date', 'Will self-heal tonight'],
      ...report.missed.map(m => [m.client, m.group, m.task, m.due_date, m.recoverable ? 'Yes' : 'No']),
    ]
    const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `missed-compliance-tasks-${report.today}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const { selfHeal, needsAction } = useMemo(() => ({
    selfHeal:    report?.missed.filter(m => m.recoverable).length  ?? 0,
    needsAction: report?.missed.filter(m => !m.recoverable).length ?? 0,
  }), [report])

  const c = report?.counts

  return (
    <div style={{ padding: '20px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>

      <header style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Missed compliance tasks
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Occurrences that should exist by {report?.today ?? 'today'} and do not.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => load()} disabled={loading} style={btn()}>
            <RefreshCw className="h-4 w-4"/> Refresh
          </button>
          {report && report.missed.length > 0 && (
            <button onClick={exportCSV} style={btn()}>
              <Download className="h-4 w-4"/> Export
            </button>
          )}
          {canSpawn && needsAction > 0 && (
            <button onClick={spawnNow} disabled={spawning} style={btn(true)}>
              <AlertCircle className="h-4 w-4"/>
              {spawning ? 'Creating…' : 'Create missing tasks'}
            </button>
          )}
        </div>
      </header>

      {loading && <Empty text="Working through every client and every calendar date…"/>}

      {!loading && report && (
        <>
          {/* The whole point of this page: separate the real problem from the
              four things that merely look like one. */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <Stat label="Missing"              value={c?.missed ?? 0}       tone="#dc2626" big/>
            <Stat label="Created"              value={c?.present ?? 0}      tone="var(--brand)"/>
            <Stat label="Before client start"  value={c?.before_start ?? 0} tone="var(--text-muted)"
                  hint="Dated before the client was onboarded. Never created, by design."/>
            <Stat label="After client end"     value={c?.after_end ?? 0}    tone="var(--text-muted)"
                  hint="Dated after the client's end date."/>
            <Stat label="Not due yet"          value={c?.not_due_yet ?? 0}  tone="var(--text-muted)"
                  hint="Their trigger date has not arrived."/>
          </div>

          {report.missed.length === 0 ? (
            <div style={{
              border: '1px solid var(--border)', borderRadius: 10, padding: '28px 16px',
              textAlign: 'center', background: 'var(--surface)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle2 className="h-6 w-6" style={{ color: 'var(--brand)' }}/>
              <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Nothing missing</strong>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                All {c?.present ?? 0} due occurrences exist. The other {(report.total - (c?.present ?? 0) - (c?.missed ?? 0))} are
                correctly skipped or not due yet.
              </span>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14,
                fontSize: 12.5, color: 'var(--text-secondary)',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Clock className="h-3 w-3"/>
                  <strong>{selfHeal}</strong> will be created automatically tonight
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle className="h-3 w-3" style={{ color: '#dc2626' }}/>
                  <strong>{needsAction}</strong> are too old for that and need the button
                </span>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)' }}>
                      {['Due date', 'Client', 'Group', 'Task', ''].map((h, i) => (
                        <th key={i} style={{
                          textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 600,
                          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.missed.map((m, i) => (
                      <tr key={`${m.client}-${m.task}-${m.due_date}-${i}`}>
                        <Td>{m.due_date}</Td>
                        <Td>{m.client}</Td>
                        <Td>{m.group}</Td>
                        <Td><span style={{ color: 'var(--text-primary)' }}>{m.task}</span></Td>
                        <Td>
                          <span style={{
                            fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 8px',
                            border: `1px solid ${m.recoverable ? 'var(--border)' : '#dc2626'}`,
                            color: m.recoverable ? 'var(--text-muted)' : '#dc2626',
                          }}>
                            {m.recoverable ? 'auto tonight' : 'needs action'}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone, hint, big }: {
  label: string; value: number; tone: string; hint?: string; big?: boolean
}) {
  return (
    <div title={hint} style={{
      border: `1px solid ${big && value > 0 ? tone : 'var(--border)'}`,
      borderRadius: 10, padding: '10px 14px', background: 'var(--surface)', minWidth: 118,
      cursor: hint ? 'help' : 'default',
    }}>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 700, color: tone }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '9px 12px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
      {children}
    </td>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{
      border: '1px dashed var(--border)', borderRadius: 10, padding: '28px 16px',
      textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
    }}>{text}</div>
  )
}

function btn(primary = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${primary ? 'var(--brand)' : 'var(--border)'}`,
    background: primary ? 'rgba(13,148,136,0.08)' : 'var(--surface)',
    color: primary ? 'var(--brand)' : 'var(--text-secondary)',
  }
}
