'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, UserPlus, TrendingUp, X } from 'lucide-react'
import { toast } from '@/store/appStore'
import {
  PIPELINE_STAGES, TERMINAL_STAGES, LEAD_STAGE_LABEL, LEAD_STAGES,
  openPipeline, weightedPipeline,
  type Lead, type LeadStage,
} from '@/lib/crm'

interface Member { id: string; name: string }
interface Perms {
  viewAll: boolean; create: boolean; edit: boolean
  convert: boolean; manageProposals: boolean
}

export default function LeadsView({
  currentUserId, currencySymbol, locale, members, perms,
}: {
  currentUserId:  string
  currencySymbol: string
  locale:         string
  members:        Member[]
  perms:          Perms
}) {
  const [leads, setLeads]     = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail]   = useState<Lead | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/leads')
      if (!r.ok) throw new Error()
      setLeads((await r.json()).data ?? [])
    } catch {
      toast.error('Could not load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const money = useCallback((n: number) => {
    // Intl rather than string concatenation, so an Indian org gets lakh
    // grouping and not 1,000,000.
    try {
      return `${currencySymbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)}`
    } catch {
      return `${currencySymbol}${Math.round(n)}`
    }
  }, [currencySymbol, locale])

  const nameOf = useCallback((id: string | null) => {
    if (!id) return 'Unassigned'
    if (id === currentUserId) return 'You'
    return members.find(m => m.id === id)?.name ?? 'Unknown'
  }, [members, currentUserId])

  const byStage = useMemo(() => {
    const map = new Map<LeadStage, Lead[]>()
    for (const s of LEAD_STAGES) map.set(s, [])
    for (const l of leads) map.get(l.stage)?.push(l)
    return map
  }, [leads])

  const totals = useMemo(() => ({
    open:     openPipeline(leads),
    weighted: weightedPipeline(leads),
    won:      leads.filter(l => l.stage === 'won').length,
    lost:     leads.filter(l => l.stage === 'lost').length,
  }), [leads])

  /** Move a lead to a new stage. Optimistic, rolled back on failure. */
  async function moveStage(lead: Lead, stage: LeadStage) {
    if (busy || lead.stage === stage) return
    setBusy(true)
    const prev = leads
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, stage } : l))
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setLeads(prev); toast.error(j.error ?? 'Could not move the lead'); return }
      setLeads(ls => ls.map(l => l.id === lead.id ? (j.data ?? l) : l))
    } catch {
      setLeads(prev)
      toast.error('Could not move the lead')
    } finally {
      setBusy(false)
    }
  }

  async function convert(lead: Lead) {
    if (busy) return
    setBusy(true)
    try {
      const r = await fetch(`/api/leads/${lead.id}/convert`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error ?? 'Could not convert the lead'); return }
      toast.success(j.already ? 'Already converted' : `Client "${j.data?.name}" created`)
      setDetail(null)
      await load()
    } catch {
      toast.error('Could not convert the lead')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '20px 24px 48px', maxWidth: 1400, margin: '0 auto' }}>

      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {perms.viewAll ? 'Every enquiry in the firm.' : 'The enquiries you own.'}
          </p>
        </div>
        {perms.create && (
          <button onClick={() => setShowForm(v => !v)} style={primaryBtn}>
            <Plus className="h-4 w-4"/> Add lead
          </button>
        )}
      </header>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat label="Open pipeline"   value={money(totals.open)}/>
        <Stat label="Weighted"        value={money(totals.weighted)}
              hint="Each open lead's value scaled by how far it has got"/>
        <Stat label="Won"             value={String(totals.won)}/>
        <Stat label="Lost"            value={String(totals.lost)}/>
      </div>

      {showForm && perms.create && (
        <LeadForm members={members} canAssign={perms.viewAll}
          onDone={async () => { setShowForm(false); await load() }}/>
      )}

      {loading && <Empty text="Loading…"/>}

      {!loading && leads.length === 0 && (
        <Empty text="No leads yet. Add your first enquiry to start the pipeline."/>
      )}

      {/* Pipeline columns. Horizontally scrollable rather than squeezed, so
          each card stays readable on a laptop. */}
      {!loading && leads.length > 0 && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {PIPELINE_STAGES.map(stage => {
            const col = byStage.get(stage) ?? []
            const sum = col.reduce((s, l) => s + (Number(l.value) || 0), 0)
            return (
              <div key={stage} style={{ minWidth: 230, flex: '1 0 230px' }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  padding: '6px 2px 8px',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {LEAD_STAGE_LABEL[stage]}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {col.length}{sum > 0 && ` · ${money(sum)}`}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.map(l => (
                    <LeadCard key={l.id} lead={l} money={money} ownerName={nameOf(l.owner_id)}
                      onClick={() => setDetail(l)}/>
                  ))}
                  {col.length === 0 && (
                    <div style={{
                      border: '1px dashed var(--border)', borderRadius: 8, padding: 14,
                      fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
                    }}>Empty</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Won / lost, kept out of the pipeline so the columns stay about
          live work. */}
      {!loading && TERMINAL_STAGES.some(s => (byStage.get(s) ?? []).length > 0) && (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            Closed
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TERMINAL_STAGES.flatMap(s => byStage.get(s) ?? []).map(l => (
              <button key={l.id} onClick={() => setDetail(l)} style={{
                border: '1px solid var(--border)', borderRadius: 8, padding: '7px 11px',
                background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left',
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>{l.company || l.name}</strong>
                {' · '}{LEAD_STAGE_LABEL[l.stage]}
                {l.converted_client_id && ' · client'}
              </button>
            ))}
          </div>
        </section>
      )}

      {detail && (
        <LeadDetail
          lead={detail} money={money} ownerName={nameOf(detail.owner_id)}
          canEdit={perms.edit || detail.owner_id === currentUserId}
          canConvert={perms.convert}
          busy={busy}
          onMove={moveStage}
          onConvert={convert}
          onClose={() => setDetail(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

function LeadCard({ lead, money, ownerName, onClick }: {
  lead: Lead; money: (n: number) => string; ownerName: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      border: '1px solid var(--border)', borderRadius: 9, padding: 11,
      background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer',
      textAlign: 'left', width: '100%',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {lead.company || lead.name}
      </div>
      {lead.company && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{lead.name}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>
          {lead.value ? money(Number(lead.value)) : '—'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ownerName}</span>
      </div>
    </button>
  )
}

/* ── Detail panel ─────────────────────────────────────────────────────────── */

interface Activity { id: string; kind: string; body: string | null; created_at: string }

function LeadDetail({
  lead, money, ownerName, canEdit, canConvert, busy, onMove, onConvert, onClose, onChanged,
}: {
  lead: Lead; money: (n: number) => string; ownerName: string
  canEdit: boolean; canConvert: boolean; busy: boolean
  onMove: (l: Lead, s: LeadStage) => void
  onConvert: (l: Lead) => void
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [note, setNote] = useState('')
  const [kind, setKind] = useState('note')
  const [saving, setSaving] = useState(false)

  const loadActivities = useCallback(async () => {
    try {
      const r = await fetch(`/api/leads/${lead.id}/activities`)
      if (r.ok) setActivities((await r.json()).data ?? [])
    } catch { /* the panel is still useful without the trail */ }
  }, [lead.id])

  useEffect(() => { loadActivities() }, [loadActivities])

  async function addNote() {
    if (!note.trim() || saving) return
    setSaving(true)
    try {
      const r = await fetch(`/api/leads/${lead.id}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, body: note }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.error ?? 'Could not save the note')
        return
      }
      setNote('')
      await loadActivities()
    } catch {
      toast.error('Could not save the note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div
        // Clicks inside must not reach the backdrop's close handler.
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: 18,
        }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {lead.company || lead.name}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
              {[lead.company && lead.name, lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
          }}><X className="h-4 w-4"/></button>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '14px 0' }}>
          <Meta label="Value"  value={lead.value ? money(Number(lead.value)) : '—'}/>
          <Meta label="Owner"  value={ownerName}/>
          <Meta label="Source" value={lead.source || '—'}/>
          <Meta label="Expected close" value={lead.expected_close || '—'}/>
        </div>

        {lead.converted_client_id && (
          <p style={{
            fontSize: 12, color: 'var(--brand)', background: 'rgba(13,148,136,0.08)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', margin: '0 0 14px',
          }}>
            Converted to a client. This lead is now read-only in the pipeline.
          </p>
        )}

        {canEdit && !lead.converted_client_id && (
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
              Move to stage
            </span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {LEAD_STAGES.map(s => (
                <button key={s} onClick={() => onMove(lead, s)} disabled={busy || s === lead.stage}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit',
                    cursor: s === lead.stage ? 'default' : 'pointer',
                    border: `1px solid ${s === lead.stage ? 'var(--brand)' : 'var(--border)'}`,
                    background: s === lead.stage ? 'rgba(13,148,136,0.08)' : 'transparent',
                    color: s === lead.stage ? 'var(--brand)' : 'var(--text-secondary)',
                    fontWeight: s === lead.stage ? 600 : 500,
                  }}>
                  {LEAD_STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {canConvert && !lead.converted_client_id && (
          <button onClick={() => onConvert(lead)} disabled={busy}
            style={{ ...primaryBtn, marginBottom: 16 }}>
            <UserPlus className="h-4 w-4"/> Convert to client
          </button>
        )}

        {lead.notes && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>
            {lead.notes}
          </p>
        )}

        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
          Activity
        </h3>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <select value={kind} onChange={e => setKind(e.target.value)} style={inputStyle}>
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
          </select>
          <input value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote() }}
            placeholder="What happened?" style={{ ...inputStyle, flex: 1 }}/>
          <button onClick={addNote} disabled={saving || !note.trim()} style={primaryBtn}>Log</button>
        </div>

        {activities.length === 0
          ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing logged yet.</p>
          : <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.map(a => (
                <li key={a.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {a.kind.replace('_', ' ')} · {new Date(a.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{a.body}</div>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  )
}

/* ── Create form ──────────────────────────────────────────────────────────── */

function LeadForm({ members, canAssign, onDone }: {
  members: Member[]; canAssign: boolean; onDone: () => void
}) {
  const [f, setF] = useState({
    name: '', company: '', email: '', phone: '', source: '',
    value: '', expected_close: '', owner_id: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!f.name.trim() || saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          // Empty strings would become '' in columns that want null, and an
          // empty owner_id would fail the membership check.
          value:          f.value ? Number(f.value) : null,
          expected_close: f.expected_close || null,
          owner_id:       f.owner_id || null,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error ?? 'Could not add the lead'); return }
      toast.success('Lead added')
      onDone()
    } catch {
      toast.error('Could not add the lead')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF(s => ({ ...s, [k]: e.target.value }))

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10, padding: 14,
      background: 'var(--surface)', marginBottom: 18,
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
    }}>
      <Field label="Contact name *"><input value={f.name} onChange={set('name')} style={inputStyle}/></Field>
      <Field label="Company"><input value={f.company} onChange={set('company')} style={inputStyle}/></Field>
      <Field label="Email"><input value={f.email} onChange={set('email')} style={inputStyle}/></Field>
      <Field label="Phone"><input value={f.phone} onChange={set('phone')} style={inputStyle}/></Field>
      <Field label="Source"><input value={f.source} onChange={set('source')} placeholder="Referral, website…" style={inputStyle}/></Field>
      <Field label="Value"><input value={f.value} onChange={set('value')} type="number" min="0" style={{ ...inputStyle, width: 110 }}/></Field>
      <Field label="Expected close"><input value={f.expected_close} onChange={set('expected_close')} type="date" style={inputStyle}/></Field>
      {canAssign && members.length > 0 && (
        <Field label="Owner">
          <select value={f.owner_id} onChange={set('owner_id')} style={inputStyle}>
            <option value="">Me</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
      )}
      <button onClick={submit} disabled={saving || !f.name.trim()} style={primaryBtn}>
        {saving ? 'Adding…' : 'Add lead'}
      </button>
    </div>
  )
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint} style={{
      border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
      background: 'var(--surface)', minWidth: 130,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
        {hint && <TrendingUp className="h-3 w-3" style={{ color: 'var(--text-muted)' }}/>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
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

const inputStyle: React.CSSProperties = {
  padding: '6px 9px', borderRadius: 7, fontSize: 13, fontFamily: 'inherit',
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
  border: '1px solid var(--brand)', background: 'rgba(13,148,136,0.08)', color: 'var(--brand)',
}
