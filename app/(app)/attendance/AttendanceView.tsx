'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { LogIn, LogOut, MapPin, Check, X, Plus, CalendarDays, Users } from 'lucide-react'
import { toast } from '@/store/appStore'
import {
  LEAVE_TYPES, LEAVE_TYPE_LABEL, ATTENDANCE_STATUS_LABEL,
  workedHours, leaveDaysCount,
  type AttendanceRecord, type LeaveRequest, type LeaveBalance, type LeaveType,
} from '@/lib/attendance'

interface Member { id: string; name: string }
interface Perms {
  viewAllAttendance: boolean
  editAttendance:    boolean
  viewAllLeave:      boolean
  approveLeave:      boolean
  manageBalances:    boolean
}

type Tab = 'today' | 'my_attendance' | 'leave' | 'balances'

export default function AttendanceView({
  currentUserId, isViewer, members, perms,
}: {
  currentUserId: string
  isViewer:      boolean
  members:       Member[]
  perms:         Perms
}) {
  const [tab, setTab] = useState<Tab>('today')

  const [records, setRecords]   = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves]     = useState<LeaveRequest[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])

  const [today, setToday]   = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState(false)
  const [showLeaveForm, setShowLeaveForm] = useState(false)

  // Month window for the "My attendance" tab.
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const nameOf = useCallback((id: string) => {
    if (id === currentUserId) return 'You'
    return members.find(m => m.id === id)?.name ?? 'Unknown'
  }, [members, currentUserId])

  /* ── Loading ───────────────────────────────────────────────────────────── */

  const loadToday = useCallback(async () => {
    try {
      const r = await fetch('/api/attendance')
      if (!r.ok) throw new Error()
      const j = await r.json()
      setRecords(j.data ?? [])
      if (j.today) setToday(j.today)
    } catch { toast.error('Could not load attendance') }
  }, [])

  const loadMonth = useCallback(async () => {
    // Last day of the chosen month: day 0 of the next month.
    const [y, m] = month.split('-').map(Number)
    const last   = new Date(Date.UTC(y, m, 0)).getUTCDate()
    try {
      const r = await fetch(`/api/attendance?from=${month}-01&to=${month}-${String(last).padStart(2, '0')}&user_id=${currentUserId}`)
      if (!r.ok) throw new Error()
      const j = await r.json()
      setRecords(j.data ?? [])
    } catch { toast.error('Could not load attendance') }
  }, [month, currentUserId])

  const loadLeave = useCallback(async () => {
    try {
      const r = await fetch('/api/leave')
      if (!r.ok) throw new Error()
      setLeaves((await r.json()).data ?? [])
    } catch { toast.error('Could not load leave requests') }
  }, [])

  const loadBalances = useCallback(async () => {
    try {
      const r = await fetch(`/api/leave/balances?year=${new Date().getFullYear()}`)
      if (!r.ok) throw new Error()
      setBalances((await r.json()).data ?? [])
    } catch { toast.error('Could not load leave balances') }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const run =
        tab === 'today'         ? loadToday
      : tab === 'my_attendance' ? loadMonth
      : tab === 'leave'         ? loadLeave
      :                           loadBalances
    run().finally(() => { if (!cancelled) setLoading(false) })
    // Guards against a slow earlier tab's response landing after the user has
    // already switched away and clearing the new tab's spinner.
    return () => { cancelled = true }
  }, [tab, loadToday, loadMonth, loadLeave, loadBalances])

  /* ── Check in / out ────────────────────────────────────────────────────── */

  const myToday = useMemo(
    () => records.find(r => r.user_id === currentUserId && (!today || r.work_date === today)),
    [records, currentUserId, today],
  )

  /** Browser location, if the user grants it. Never blocks the check-in:
   *  a denial or a timeout resolves to nothing and we post without it. */
  function getPosition(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
      const done = (v: { lat: number; lng: number } | null) => resolve(v)
      navigator.geolocation.getCurrentPosition(
        p => done({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => done(null),
        { timeout: 8000, maximumAge: 60_000 },
      )
    })
  }

  async function punch(action: 'check_in' | 'check_out') {
    if (busy) return
    setBusy(true)
    try {
      const pos = await getPosition()
      const body: Record<string, unknown> = { action }
      if (pos) {
        if (action === 'check_in') { body.check_in_lat = pos.lat;  body.check_in_lng = pos.lng }
        else                       { body.check_out_lat = pos.lat; body.check_out_lng = pos.lng }
      }
      const r = await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error ?? 'Could not record attendance'); return }
      if (!j.already) toast.success(action === 'check_in' ? 'Checked in' : 'Checked out')
      await loadToday()
    } catch {
      toast.error('Could not record attendance')
    } finally {
      setBusy(false)
    }
  }

  /* ── Leave decisions ───────────────────────────────────────────────────── */

  async function decide(id: string, decision: 'approve' | 'reject' | 'cancel') {
    if (busy) return
    setBusy(true)
    // Optimistic, with the previous list captured for rollback — the pattern
    // the rest of the app uses.
    const prev = leaves
    setLeaves(ls => ls.map(l => l.id === id
      ? { ...l, status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'cancelled' }
      : l))
    try {
      const r = await fetch(`/api/leave/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setLeaves(prev); toast.error(j.error ?? 'Could not update the request'); return }
      toast.success(decision === 'approve' ? 'Leave approved' : decision === 'reject' ? 'Leave rejected' : 'Request cancelled')
      await loadLeave()
    } catch {
      setLeaves(prev)
      toast.error('Could not update the request')
    } finally {
      setBusy(false)
    }
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  const TABS: { key: Tab; label: string; show: boolean }[] = [
    { key: 'today',         label: 'Today',          show: true },
    { key: 'my_attendance', label: 'My attendance',  show: true },
    { key: 'leave',         label: 'Leave',          show: true },
    { key: 'balances',      label: 'Leave balances', show: true },
  ]

  return (
    <div style={{ padding: '20px 24px 48px', maxWidth: 1100, margin: '0 auto' }}>

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Attendance &amp; leave
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          {perms.viewAllAttendance
            ? "Check in for yourself and see the whole team's day."
            : 'Check in and out, and request leave.'}
        </p>
      </header>

      {/* Punch card */}
      {!isViewer && (
        <section style={{
          border: '1px solid var(--border)', borderRadius: 12, padding: 16,
          background: 'var(--surface)', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{today || '—'}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
              {!myToday?.check_in_at ? 'Not checked in yet'
                : myToday.check_out_at
                  ? `Done for the day · ${workedHours(myToday) ?? '—'} h`
                  : `Checked in at ${fmtTime(myToday.check_in_at)}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => punch('check_in')}
              disabled={busy || !!myToday?.check_in_at}
              style={btn(!myToday?.check_in_at)}>
              <LogIn className="h-4 w-4"/> Check in
            </button>
            <button onClick={() => punch('check_out')}
              disabled={busy || !myToday?.check_in_at || !!myToday?.check_out_at}
              style={btn(!!myToday?.check_in_at && !myToday?.check_out_at)}>
              <LogOut className="h-4 w-4"/> Check out
            </button>
          </div>
        </section>
      )}

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {TABS.filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
              color: tab === t.key ? 'var(--brand)' : 'var(--text-secondary)',
              fontWeight: tab === t.key ? 600 : 500,
            }}>
            {t.label}
          </button>
        ))}
      </nav>

      {loading && <Empty icon={<CalendarDays className="h-5 w-5"/>} text="Loading…"/>}

      {/* ── Today ───────────────────────────────────────────────────────── */}
      {!loading && tab === 'today' && (
        records.length === 0
          ? <Empty icon={<Users className="h-5 w-5"/>} text="Nobody has checked in yet today."/>
          : <Table head={['Member', 'In', 'Out', 'Hours', 'Status', '']}>
              {records.map(r => (
                <tr key={r.id}>
                  <Td>{nameOf(r.user_id)}</Td>
                  <Td>{fmtTime(r.check_in_at)}</Td>
                  <Td>{fmtTime(r.check_out_at)}</Td>
                  <Td>{workedHours(r) ?? '—'}</Td>
                  <Td>{ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}</Td>
                  <Td>
                    {r.check_in_lat != null && (
                      <span title={`${r.check_in_lat}, ${r.check_in_lng}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <MapPin className="h-3 w-3"/>{r.check_in_label ?? 'Located'}
                      </span>
                    )}
                    {r.source === 'manual' && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>· entered manually</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
      )}

      {/* ── My attendance ───────────────────────────────────────────────── */}
      {!loading && tab === 'my_attendance' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              style={input()}/>
          </div>
          {records.length === 0
            ? <Empty icon={<CalendarDays className="h-5 w-5"/>} text="No attendance recorded this month."/>
            : <Table head={['Date', 'In', 'Out', 'Hours', 'Status']}>
                {records.map(r => (
                  <tr key={r.id}>
                    <Td>{r.work_date}</Td>
                    <Td>{fmtTime(r.check_in_at)}</Td>
                    <Td>{fmtTime(r.check_out_at)}</Td>
                    <Td>{workedHours(r) ?? '—'}</Td>
                    <Td>{ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}</Td>
                  </tr>
                ))}
              </Table>}
        </>
      )}

      {/* ── Leave ───────────────────────────────────────────────────────── */}
      {!loading && tab === 'leave' && (
        <>
          {!isViewer && (
            <button onClick={() => setShowLeaveForm(v => !v)} style={{ ...btn(true), marginBottom: 14 }}>
              <Plus className="h-4 w-4"/> Request leave
            </button>
          )}
          {showLeaveForm && (
            <LeaveForm onDone={async () => { setShowLeaveForm(false); await loadLeave() }}/>
          )}
          {leaves.length === 0
            ? <Empty icon={<CalendarDays className="h-5 w-5"/>} text="No leave requests."/>
            : <Table head={['Member', 'Type', 'From', 'To', 'Days', 'Status', '']}>
                {leaves.map(l => (
                  <tr key={l.id}>
                    <Td>{nameOf(l.user_id)}</Td>
                    <Td>{LEAVE_TYPE_LABEL[l.leave_type] ?? l.leave_type}</Td>
                    <Td>{l.start_date}</Td>
                    <Td>{l.half_day ? `${l.end_date} (half)` : l.end_date}</Td>
                    <Td>{l.days_count}</Td>
                    <Td><StatusPill status={l.status}/></Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* Nobody decides their own request — including an
                            admin. The API enforces it; this hides the buttons
                            so the rule is visible rather than a surprise. */}
                        {perms.approveLeave && l.status === 'pending' && l.user_id !== currentUserId && (
                          <>
                            <button onClick={() => decide(l.id, 'approve')} disabled={busy} style={miniBtn('var(--brand)')}>
                              <Check className="h-3 w-3"/> Approve
                            </button>
                            <button onClick={() => decide(l.id, 'reject')} disabled={busy} style={miniBtn('#dc2626')}>
                              <X className="h-3 w-3"/> Reject
                            </button>
                          </>
                        )}
                        {l.status === 'pending' && l.user_id === currentUserId && (
                          <button onClick={() => decide(l.id, 'cancel')} disabled={busy} style={miniBtn('var(--text-muted)')}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>}
        </>
      )}

      {/* ── Balances ────────────────────────────────────────────────────── */}
      {!loading && tab === 'balances' && (
        balances.length === 0
          ? <Empty icon={<CalendarDays className="h-5 w-5"/>}
              text={perms.manageBalances
                ? 'No entitlements set yet. A balance row appears once leave is approved, or set one per member.'
                : 'No leave balances recorded for you yet.'}/>
          : <Table head={['Member', 'Type', 'Entitled', 'Used', 'Remaining']}>
              {balances.map(b => (
                <tr key={b.id}>
                  <Td>{nameOf(b.user_id)}</Td>
                  <Td>{LEAVE_TYPE_LABEL[b.leave_type] ?? b.leave_type}</Td>
                  <Td>{b.entitled}</Td>
                  <Td>{b.used}</Td>
                  {/* Can go negative when leave is approved beyond the
                      entitlement; showing that is the point. */}
                  <Td>{Number(b.entitled) - Number(b.used)}</Td>
                </tr>
              ))}
            </Table>
      )}
    </div>
  )
}

/* ── Leave request form ───────────────────────────────────────────────────── */

function LeaveForm({ onDone }: { onDone: () => void }) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const [type, setType]   = useState<LeaveType>('casual')
  const [from, setFrom]   = useState(todayIso)
  const [to, setTo]       = useState(todayIso)
  const [half, setHalf]   = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  // Same helper the server uses, so the preview and the stored figure agree.
  const days = leaveDaysCount(from, to, half)

  async function submit() {
    if (saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_type: type, start_date: from, end_date: to, half_day: half, reason }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error ?? 'Could not submit the request'); return }
      toast.success('Leave requested')
      onDone()
    } catch {
      toast.error('Could not submit the request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10, padding: 14,
      background: 'var(--surface)', marginBottom: 16,
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
    }}>
      <Field label="Type">
        <select value={type} onChange={e => setType(e.target.value as LeaveType)} style={input()}>
          {LEAVE_TYPES.map(t => <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>)}
        </select>
      </Field>
      <Field label="From">
        <input type="date" value={from} style={input()}
          onChange={e => {
            const v = e.target.value
            setFrom(v)
            // Keep the range valid rather than letting the server reject it.
            if (to < v) setTo(v)
            if (half) setTo(v)
          }}/>
      </Field>
      <Field label="To">
        <input type="date" value={to} min={from} disabled={half} style={input()}
          onChange={e => setTo(e.target.value)}/>
      </Field>
      <Field label="">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={half} style={{ accentColor: 'var(--brand)' }}
            onChange={e => {
              setHalf(e.target.checked)
              // A half day is one date by definition.
              if (e.target.checked) setTo(from)
            }}/>
          Half day
        </label>
      </Field>
      <Field label="Reason">
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Optional" style={{ ...input(), minWidth: 200 }}/>
      </Field>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8 }}>
        {days > 0 ? `${days} working day${days === 1 ? '' : 's'}` : 'No working days in range'}
      </div>
      <button onClick={submit} disabled={saving || days <= 0} style={btn(days > 0)}>
        {saving ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}

/* ── Small presentational helpers ─────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>}
      {children}
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface-subtle)' }}>
            {head.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 600,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
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

function StatusPill({ status }: { status: string }) {
  const color =
      status === 'approved'  ? 'var(--brand)'
    : status === 'rejected'  ? '#dc2626'
    : status === 'cancelled' ? 'var(--text-muted)'
    :                          '#d97706'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, textTransform: 'capitalize',
      border: `1px solid ${color}`, borderRadius: 20, padding: '2px 8px',
    }}>{status}</span>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{
      border: '1px dashed var(--border)', borderRadius: 10, padding: '28px 16px',
      textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      {icon}{text}
    </div>
  )
}

function btn(enabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', cursor: enabled ? 'pointer' : 'not-allowed',
    border: '1px solid var(--border)',
    background: enabled ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
    color: enabled ? 'var(--brand)' : 'var(--text-muted)',
    opacity: enabled ? 1 : 0.7,
  }
}

function miniBtn(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${color}`, background: 'transparent', color,
  }
}

function input(): React.CSSProperties {
  return {
    padding: '6px 9px', borderRadius: 7, fontSize: 13, fontFamily: 'inherit',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text-primary)', outline: 'none',
  }
}

/** Local time of day, or an em dash. */
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
