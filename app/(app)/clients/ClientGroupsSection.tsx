'use client'
import { useState } from 'react'
import { Plus, X, Pencil, Trash2, Users2, Building2, Check, ChevronRight } from 'lucide-react'
import { toast } from '@/store/appStore'

type Group = { id: string; name: string; color: string; notes: string | null }
type Client = { id: string; name: string; color: string; status: string; group_id: string | null }

const GROUP_COLORS = [
  '#0d9488','#7c3aed','#0891b2','#16a34a',
  '#ea580c','#dc2626','#d97706','#db2777',
  '#64748b','#1d4ed8',
]

interface Props {
  initialGroups: Group[]
  allClients:    Client[]
  canManage:     boolean
}

export function ClientGroupsSection({ initialGroups, allClients, canManage }: Props) {
  const [groups,      setGroups]      = useState<Group[]>(initialGroups)
  const [clients,     setClients]     = useState<Client[]>(allClients)
  const [panelGroup,  setPanelGroup]  = useState<Group | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)

  // ── create form state ────────────────────────────────────────────────────
  const [cName,  setCName]  = useState('')
  const [cColor, setCColor] = useState(GROUP_COLORS[0])
  const [cNotes, setCNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // ── edit form state (inline in panel) ───────────────────────────────────
  const [eName,  setEName]  = useState('')
  const [eColor, setEColor] = useState('')
  const [eNotes, setENotes] = useState('')

  function openPanel(g: Group) {
    setPanelGroup(g)
    setEName(g.name)
    setEColor(g.color)
    setENotes(g.notes ?? '')
    setEditingId(null)
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  function groupClients(gid: string) { return clients.filter(c => c.group_id === gid) }
  function ungroupedClients()        { return clients.filter(c => !c.group_id) }

  // ── create group ─────────────────────────────────────────────────────────
  async function createGroup() {
    if (!cName.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/client-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cName.trim(), color: cColor, notes: cNotes || null }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed to create group'); return }
      setGroups(prev => [...prev, d.data].sort((a, b) => a.name.localeCompare(b.name)))
      setCName(''); setCColor(GROUP_COLORS[0]); setCNotes('')
      setShowCreate(false)
      toast.success('Group created')
    } finally { setSaving(false) }
  }

  // ── save group edits ──────────────────────────────────────────────────────
  async function saveGroupEdit(id: string) {
    if (!eName.trim()) { toast.error('Name is required'); return }
    const res = await fetch(`/api/client-groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: eName.trim(), color: eColor, notes: eNotes || null }),
    })
    const d = await res.json()
    if (!res.ok) { toast.error(d.error ?? 'Failed to update group'); return }
    const updated = { ...d.data }
    setGroups(prev => prev.map(g => g.id === id ? updated : g))
    setPanelGroup(updated)
    setEditingId(null)
    toast.success('Group updated')
  }

  // ── delete group ──────────────────────────────────────────────────────────
  async function deleteGroup(g: Group) {
    if (!confirm(`Delete group "${g.name}"? All clients in it will become ungrouped.`)) return
    const res = await fetch(`/api/client-groups/${g.id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed'); return }
    setGroups(prev => prev.filter(x => x.id !== g.id))
    setClients(prev => prev.map(c => c.group_id === g.id ? { ...c, group_id: null } : c))
    if (panelGroup?.id === g.id) setPanelGroup(null)
    toast.success('Group deleted')
  }

  // ── assign / remove client ────────────────────────────────────────────────
  async function assignClient(clientId: string, groupId: string | null) {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed'); return }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, group_id: groupId } : c))
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 48 }}>
      {/* ── section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Client Groups
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            {groups.length} group{groups.length !== 1 ? 's' : ''} — organise clients under a parent company or family business
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            <Plus style={{ width: 14, height: 14 }} /> New group
          </button>
        )}
      </div>

      {/* ── create group form ── */}
      {showCreate && (
        <div style={{
          background: 'var(--surface)', border: '1.5px solid var(--brand)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>New group</span>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Group name *
              </label>
              <input
                value={cName} onChange={e => setCName(e.target.value)}
                placeholder="e.g. Sharma Family Business"
                autoFocus
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Notes
              </label>
              <input
                value={cNotes} onChange={e => setCNotes(e.target.value)}
                placeholder="Optional description"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Colour</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GROUP_COLORS.map(col => (
                <button key={col} onClick={() => setCColor(col)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: col, border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  outline: cColor === col ? `3px solid ${col}` : 'none', outlineOffset: 2,
                }}>
                  {cColor === col && <Check style={{ width: 13, height: 13, color: '#fff' }} />}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createGroup} disabled={saving} style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Creating…' : 'Create group'}
            </button>
            <button onClick={() => setShowCreate(false)} style={{
              padding: '8px 14px', borderRadius: 7, border: '1.5px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── empty state ── */}
      {groups.length === 0 && !showCreate && (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          border: '2px dashed var(--border)', borderRadius: 12,
          background: 'var(--surface-subtle)',
        }}>
          <Building2 style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>No groups yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Group related clients under a parent company or family business
          </p>
          {canManage && (
            <button onClick={() => setShowCreate(true)} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Create first group
            </button>
          )}
        </div>
      )}

      {/* ── groups grid ── */}
      {groups.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {groups.map(g => {
            const members = groupClients(g.id)
            return (
              <div
                key={g.id}
                onClick={() => openPanel(g)}
                style={{
                  background: 'var(--surface)', border: '1.5px solid var(--border)',
                  borderRadius: 12, padding: '16px 18px',
                  cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--brand)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
              >
                {/* top-right actions */}
                {canManage && (
                  <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}
                    onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openPanel(g)}
                      title="Edit group"
                      style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Pencil style={{ width: 12, height: 12 }} />
                    </button>
                    <button
                      onClick={() => deleteGroup(g)}
                      title="Delete group"
                      style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.05)', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Building2 style={{ width: 20, height: 20, color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: canManage ? 56 : 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </p>
                    {g.notes && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {members.slice(0, 4).map(c => (
                      <div key={c.id} title={c.name} style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: c.color, color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid var(--surface)',
                        marginLeft: -6,
                      }}>
                        {c.name[0]?.toUpperCase()}
                      </div>
                    ))}
                    {members.length > 4 && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)', marginLeft: -6 }}>
                        +{members.length - 4}
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: members.length > 0 ? 4 : 0 }}>
                      {members.length} client{members.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── group detail panel ── */}
      {panelGroup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
          display: 'flex', justifyContent: 'flex-end',
        }} onClick={e => { if (e.target === e.currentTarget) setPanelGroup(null) }}>
          <div style={{
            width: '100%', maxWidth: 480, height: '100%',
            background: 'var(--surface)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* panel header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: panelGroup.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {panelGroup.name}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  {groupClients(panelGroup.id).length} client{groupClients(panelGroup.id).length !== 1 ? 's' : ''}
                </p>
              </div>
              {canManage && editingId !== panelGroup.id && (
                <button onClick={() => setEditingId(panelGroup.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 6 }}>
                  <Pencil style={{ width: 15, height: 15 }} />
                </button>
              )}
              <button onClick={() => setPanelGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* ── edit group details ── */}
              {canManage && editingId === panelGroup.id && (
                <div style={{ background: 'var(--surface-subtle)', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Edit group</p>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Name</label>
                    <input value={eName} onChange={e => setEName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Notes</label>
                    <input value={eNotes} onChange={e => setENotes(e.target.value)} placeholder="Optional description" style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Colour</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {GROUP_COLORS.map(col => (
                        <button key={col} onClick={() => setEColor(col)} style={{ width: 26, height: 26, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: eColor === col ? `3px solid ${col}` : 'none', outlineOffset: 2 }}>
                          {eColor === col && <Check style={{ width: 12, height: 12, color: '#fff' }} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveGroupEdit(panelGroup.id)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: '7px 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── clients in this group ── */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
                  Members ({groupClients(panelGroup.id).length})
                </p>
                {groupClients(panelGroup.id).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', border: '2px dashed var(--border)', borderRadius: 10, background: 'var(--surface-subtle)' }}>
                    <Users2 style={{ width: 28, height: 28, color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No clients in this group yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {groupClients(panelGroup.id).map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: c.color, color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, textTransform: 'capitalize' }}>{c.status}</p>
                        </div>
                        {canManage && (
                          <button
                            onClick={() => assignClient(c.id, null)}
                            title="Remove from group"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 5, display: 'flex' }}>
                            <X style={{ width: 14, height: 14 }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── add clients ── */}
              {canManage && ungroupedClients().length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
                    Add clients ({ungroupedClients().length} ungrouped)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ungroupedClients().map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: c.color, color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {c.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, textTransform: 'capitalize' }}>{c.status}</p>
                        </div>
                        <button
                          onClick={() => assignClient(c.id, panelGroup.id)}
                          title="Add to group"
                          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Plus style={{ width: 12, height: 12 }} /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── danger zone ── */}
              {canManage && (
                <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => deleteGroup(panelGroup)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.05)', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Trash2 style={{ width: 14, height: 14 }} /> Delete this group
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
