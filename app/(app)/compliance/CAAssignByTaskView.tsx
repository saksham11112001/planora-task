'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Check, ArrowLeft, Users } from 'lucide-react'
import { toast } from '@/store/appStore'

/**
 * Assign ONE compliance task to MANY clients.
 *
 * WHY THIS EXISTS
 * ---------------
 * Client Setup works the other way round: pick a client, then tick the tasks
 * that apply to them. That is right when a new client is onboarded, and wrong
 * for almost everything else a firm does.
 *
 * The real sentence is usually about a statute, not a client: "GSTR-3B applies
 * to these forty clients", "this year TDS 26Q covers everyone except the three
 * proprietorships". Client-first forces that into forty separate visits, each
 * one re-reading the same long task list to tick one box — and there is no
 * point at which the firm can see which clients have the task and which do
 * not, which is the question they actually wanted answered.
 *
 * The API has accepted an array of (task, client) pairs all along, and its own
 * comment describes "give these 40 clients the ITR task". Only the screen was
 * missing.
 *
 * TWO STEPS, DELIBERATELY
 * -----------------------
 * Pick the task, then pick the clients. Not a grid of every task against every
 * client: a firm with 80 tasks and 200 clients has 16,000 cells, which is a
 * screen nobody can use and the exact kind of complexity this module already
 * has too much of.
 */

interface MasterTask {
  id: string
  code: string
  name: string
  group_name: string
}
interface ClientRow { id: string; name: string; color: string }
interface Member     { id: string; name: string; role?: string }

interface Props {
  financialYear: string
  clients: ClientRow[]
  members: Member[]
  canEdit: boolean
}

export function CAAssignByTaskView({
  financialYear, clients, members, canEdit,
}: Props) {
  const [tasks,    setTasks]    = useState<MasterTask[]>([])
  const [loading,  setLoading]  = useState(true)
  const [taskSearch,   setTaskSearch]   = useState('')
  const [clientSearch, setClientSearch] = useState('')

  const [picked, setPicked] = useState<MasterTask | null>(null)
  /**
   * Clients that already have this task, mapped to the assignment row's id.
   *
   * The id is kept because removal is `DELETE /api/ca/assignments/{id}` —
   * the collection endpoint only adds, so there is no way to delete by
   * (task, client) pair.
   */
  const [alreadyById, setAlreadyById] = useState<Record<string, string>>({})
  const already = useMemo(() => new Set(Object.keys(alreadyById)), [alreadyById])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loadingAssigned, setLoadingAssigned] = useState(false)
  const [saving, setSaving] = useState(false)
  /** Optional: one assignee for every client being added in this pass. */
  const [bulkAssignee, setBulkAssignee] = useState('')

  /** How many clients hold each task, so the picker can say so before you
   *  commit to opening one. */
  const [counts, setCounts] = useState<Record<string, number>>({})

  /* ── Load the year's master tasks, and the per-task client counts ── */
  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetch(`/api/ca/master?fy=${encodeURIComponent(financialYear)}`).then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/ca/assignments').then(r => r.ok ? r.json() : { data: [] }),
    ])
      .then(([mt, asg]) => {
        if (!alive) return
        setTasks(Array.isArray(mt) ? mt : (mt.data ?? []))
        const tally: Record<string, number> = {}
        for (const a of (Array.isArray(asg) ? asg : (asg.data ?? [])) as { master_task_id: string }[]) {
          tally[a.master_task_id] = (tally[a.master_task_id] ?? 0) + 1
        }
        setCounts(tally)
      })
      .catch(() => { if (alive) toast.error('Could not load the compliance calendar') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [financialYear])

  /* ── Which clients already have the picked task ── */
  const openTask = useCallback(async (task: MasterTask) => {
    setPicked(task)
    setChecked(new Set())
    setBulkAssignee('')
    setClientSearch('')
    setLoadingAssigned(true)
    try {
      const res = await fetch(`/api/ca/assignments?master_task_id=${encodeURIComponent(task.id)}`)
      const json = await res.json()
      const rows = (Array.isArray(json) ? json : (json.data ?? [])) as { id: string; client_id: string }[]
      const byClient: Record<string, string> = {}
      for (const r of rows) byClient[r.client_id] = r.id
      setAlreadyById(byClient)
      // Pre-ticked to what is already true, so the list reads as the current
      // state of the world and a save is a diff against it. Starting empty
      // would make "assign" look like it was about to remove everything.
      setChecked(new Set(Object.keys(byClient)))
    } catch {
      toast.error('Could not load who already has this task')
      setAlreadyById({})
    } finally {
      setLoadingAssigned(false)
    }
  }, [])

  /* ── Task picker list, grouped ── */
  const groupedTasks = useMemo(() => {
    const q = taskSearch.toLowerCase().trim()
    const map = new Map<string, MasterTask[]>()
    for (const t of tasks) {
      if (q && !t.name.toLowerCase().includes(q)
            && !t.code.toLowerCase().includes(q)
            && !t.group_name.toLowerCase().includes(q)) continue
      if (!map.has(t.group_name)) map.set(t.group_name, [])
      map.get(t.group_name)!.push(t)
    }
    return map
  }, [tasks, taskSearch])

  const shownClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()
    return q ? clients.filter(c => c.name.toLowerCase().includes(q)) : clients
  }, [clients, clientSearch])

  // The save is a diff, and it is spelled out before anything happens.
  const toAdd    = useMemo(() => [...checked].filter(id => !already.has(id)), [checked, already])
  const toRemove = useMemo(() => [...already].filter(id => !checked.has(id)), [checked, already])

  async function save() {
    if (!picked || saving) return
    if (toAdd.length === 0 && toRemove.length === 0) {
      toast.info('Nothing to change')
      return
    }
    setSaving(true)
    try {
      if (toAdd.length > 0) {
        const res = await fetch('/api/ca/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignments: toAdd.map(clientId => ({
              master_task_id: picked.id,
              client_id: clientId,
              assignee_id: bulkAssignee || null,
              approver_id: null,
              start_date: null,
              end_date: null,
            })),
            // Existing rows are left exactly as they are. A bulk assign must
            // never quietly reset an assignee somebody set by hand.
            skip_existing: true,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? 'Could not add assignments')
        }
      }

      // Removals go one at a time, by assignment id: the collection endpoint
      // only adds, and DELETE is per row.
      let removeFailed = 0
      for (const clientId of toRemove) {
        const assignmentId = alreadyById[clientId]
        if (!assignmentId) { removeFailed++; continue }
        const res = await fetch(`/api/ca/assignments/${assignmentId}`, { method: 'DELETE' })
        if (!res.ok) removeFailed++
      }

      const parts: string[] = []
      if (toAdd.length)    parts.push(`${toAdd.length} client${toAdd.length !== 1 ? 's' : ''} added`)
      if (toRemove.length - removeFailed > 0) parts.push(`${toRemove.length - removeFailed} removed`)
      toast.success(parts.join(' · ') || 'Saved')
      if (removeFailed > 0) toast.error(`${removeFailed} could not be removed`)

      // Re-read rather than assuming: the list now shows what the server
      // actually holds, which is the point of the screen.
      await openTask(picked)
      setCounts(c => ({ ...c, [picked.id]: (c[picked.id] ?? 0) + toAdd.length - (toRemove.length - removeFailed) }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  /* ─────────────────────────── Render ─────────────────────────── */

  if (loading) {
    return <p style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Loading the compliance calendar…</p>
  }

  /* Step 2 — clients for the picked task */
  if (picked) {
    const allShownChecked = shownClients.length > 0 && shownClients.every(c => checked.has(c.id))
    return (
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setPicked(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, background: 'none',
              border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: 'var(--text-secondary)', fontFamily: 'inherit',
            }}>
            <ArrowLeft size={13} /> All tasks
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              {picked.name}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              {picked.group_name} · {picked.code} · FY {financialYear}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
            <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients…"
              style={{
                width: '100%', padding: '6px 10px 6px 28px', borderRadius: 7,
                border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit',
                background: 'var(--surface)', color: 'var(--text-primary)',
              }} />
          </div>

          <button onClick={() => {
            setChecked(prev => {
              const n = new Set(prev)
              // Operates on what is VISIBLE, so it reads as "select all of
              // these" rather than silently reaching past the search filter.
              if (allShownChecked) shownClients.forEach(c => n.delete(c.id))
              else                 shownClients.forEach(c => n.add(c.id))
              return n
            })
          }}
            disabled={!canEdit || shownClients.length === 0}
            style={{
              padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--surface)', cursor: canEdit ? 'pointer' : 'default',
              fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit',
            }}>
            {allShownChecked ? 'Clear' : 'Select'} {clientSearch ? 'these' : 'all'} ({shownClients.length})
          </button>

          {members.length > 0 && (
            <select value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)}
              disabled={!canEdit}
              title="Assignee for the clients being added. Existing assignments keep whoever is already on them."
              style={{
                padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
                fontSize: 12, fontFamily: 'inherit', background: 'var(--surface)',
                color: 'var(--text-primary)', maxWidth: 180,
              }}>
              <option value="">Assignee for new (optional)</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>

        {/* What the save will do, stated before it happens. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: toAdd.length || toRemove.length ? '#fffbeb' : 'var(--surface-alt)',
          border: `1px solid ${toAdd.length || toRemove.length ? '#f59e0b' : 'var(--border)'}`,
          borderRadius: 8, padding: '8px 12px',
        }}>
          <span style={{ fontSize: 12, color: toAdd.length || toRemove.length ? '#92400e' : 'var(--text-secondary)' }}>
            {loadingAssigned ? 'Checking who already has this…'
              : toAdd.length === 0 && toRemove.length === 0
                ? `${already.size} client${already.size !== 1 ? 's' : ''} have this task. Nothing to change.`
                : [
                    toAdd.length    ? `add ${toAdd.length}` : '',
                    toRemove.length ? `remove ${toRemove.length}` : '',
                  ].filter(Boolean).join(', ')}
          </span>
          {canEdit && (toAdd.length > 0 || toRemove.length > 0) && (
            <>
              <button onClick={save} disabled={saving}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
                  fontFamily: 'inherit',
                }}>
                {saving ? 'Saving…' : 'Apply'}
              </button>
              <button onClick={() => setChecked(new Set(already))} disabled={saving}
                style={{
                  padding: '6px 10px', borderRadius: 7, border: '1px solid #fcd34d',
                  background: 'transparent', color: '#92400e', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Reset
              </button>
            </>
          )}
        </div>

        {/* Client checkboxes */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, border: '1px solid var(--border)', borderRadius: 8 }}>
          {shownClients.length === 0 && (
            <p style={{ margin: 0, padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              No clients match.
            </p>
          )}
          {shownClients.map((c, i) => {
            const on   = checked.has(c.id)
            const had  = already.has(c.id)
            // Three states worth telling apart: unchanged, being added, being
            // removed. Without this a ticked box cannot say whether it is
            // already true or about to become true.
            const state = on && !had ? 'adding' : !on && had ? 'removing' : on ? 'current' : 'none'
            return (
              <label key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  cursor: canEdit ? 'pointer' : 'default',
                  background: state === 'adding' ? 'rgba(13,148,136,0.07)'
                    : state === 'removing' ? 'rgba(220,38,38,0.06)' : 'transparent',
                }}>
                <input type="checkbox" checked={on} disabled={!canEdit}
                  onChange={() => setChecked(prev => {
                    const n = new Set(prev)
                    if (n.has(c.id)) n.delete(c.id); else n.add(c.id)
                    return n
                  })}
                  style={{ width: 15, height: 15, cursor: canEdit ? 'pointer' : 'default', accentColor: 'var(--brand)' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)' }}>{c.name}</span>
                {state === 'current' && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Check size={11} /> assigned
                  </span>
                )}
                {state === 'adding'   && <span style={{ fontSize: 10, fontWeight: 700, color: '#0d9488' }}>+ adding</span>}
                {state === 'removing' && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>− removing</span>}
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  /* Step 1 — pick a task */
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Pick a compliance task, then choose every client it applies to. Use this when a
          statute applies across your book — the other direction (one client, many tasks)
          is on the Client Setup tab.
        </p>
      </div>

      <div style={{ position: 'relative', maxWidth: 340 }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }} />
        <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
          placeholder="Search tasks…"
          style={{
            width: '100%', padding: '6px 10px 6px 28px', borderRadius: 7,
            border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit',
            background: 'var(--surface)', color: 'var(--text-primary)',
          }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {groupedTasks.size === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            No tasks match. {tasks.length === 0 && 'Load the statutory calendar on the Compliance Calendar tab first.'}
          </p>
        )}
        {[...groupedTasks.entries()].map(([group, list]) => (
          <div key={group} style={{ marginBottom: 14 }}>
            <p style={{
              margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--text-muted)',
            }}>
              {group}
            </p>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {list.map((t, i) => (
                <button key={t.id} onClick={() => void openTask(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    textAlign: 'left', padding: '9px 14px', cursor: 'pointer',
                    background: 'none', border: 'none', fontFamily: 'inherit',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t.name}
                  </span>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                    color: (counts[t.id] ?? 0) > 0 ? '#0d9488' : 'var(--text-muted)',
                    fontWeight: (counts[t.id] ?? 0) > 0 ? 700 : 400,
                  }}>
                    <Users size={11} />
                    {counts[t.id] ?? 0}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>Choose clients →</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
