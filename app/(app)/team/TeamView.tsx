'use client'
import { useState }   from 'react'
import { useRouter }  from 'next/navigation'
import { UserPlus, Mail, Crown, Shield, User, ChevronDown, Check, Plus, X, Send } from 'lucide-react'
import { cn }         from '@/lib/utils/cn'
import { toast }      from '@/store/appStore'
import { fmtDate }    from '@/lib/utils/format'

const ROLES = ['admin','manager','member','viewer'] as const
const ROLE_DESC: Record<string, string> = {
  owner:   'Full access, billing, can delete org',
  admin:   'Full access except billing & org deletion',
  manager: 'Create/assign tasks, invite members, view reports',
  member:  'Create own tasks, update assigned tasks',
  viewer:  'Read-only — can view but not edit anything',
}
const ROLE_ICONS: Record<string, any> = { owner: Crown, admin: Shield, manager: UserPlus, member: User, viewer: User }
const ROLE_COLORS: Record<string, string> = {
  owner: '#ca8a04', admin: '#7c3aed', manager: '#0d9488', member: '#64748b', viewer: '#94a3b8'
}

interface InviteRow { email: string; role: 'admin'|'manager'|'member'|'viewer' }
interface Member {
  id: string; name: string; email: string; avatar_url: string | null
  role: string; joined_at: string; tasks_30d: number; done_30d: number; inprog_30d?: number
}

export function TeamView({ members, canManage, currentUserId }: {
  members: Member[]; canManage: boolean; currentUserId: string
}) {
  const router = useRouter()

  // Single invite state
  const [showInvite,  setShowInvite]  = useState(false)

  // Bulk invite state — list of rows
  const [showBulk,    setShowBulk]    = useState(false)
  const [bulkRows,    setBulkRows]    = useState<InviteRow[]>([
    { email: '', role: 'member' },
  ])
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResults, setBulkResults] = useState<{email:string;ok:boolean;msg:string}[]>([])

  // Single invite state
  const [invEmail,    setInvEmail]    = useState('')
  const [invRole,     setInvRole]     = useState<'manager'|'member'|'viewer'>('member')
  const [inviting,    setInviting]    = useState(false)

  const [roleEditing, setRoleEditing] = useState<string | null>(null)
  const [saving,      setSaving]      = useState<string | null>(null)

  // ── Single invite ──────────────────────────────────────────────────────
  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!invEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invEmail.trim(), role: invRole }),
    })
    setInviting(false)
    const d = await res.json()
    if (res.ok) {
      toast.success('Invite sent!')
      setInvEmail('')
      setShowInvite(false)
      router.refresh()
    } else {
      toast.error(d.error ?? 'Failed to invite')
    }
  }

  // ── Bulk invite ────────────────────────────────────────────────────────
  function addBulkRow() {
    setBulkRows(r => [...r, { email: '', role: 'member' }])
  }

  function updateBulkRow(i: number, field: keyof InviteRow, value: string) {
    setBulkRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  function removeBulkRow(i: number) {
    setBulkRows(r => r.filter((_, idx) => idx !== i))
  }

  async function sendBulk() {
    const valid = bulkRows.filter(r => r.email.trim())
    if (!valid.length) { toast.error('Add at least one email'); return }
    setBulkSending(true)
    setBulkResults([])

    const results: {email:string;ok:boolean;msg:string}[] = []
    for (const row of valid) {
      const res = await fetch('/api/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: row.email.trim(), role: row.role }),
      })
      const d = await res.json()
      results.push({ email: row.email, ok: res.ok, msg: res.ok ? 'Invited' : (d.error ?? 'Failed') })
    }

    setBulkSending(false)
    setBulkResults(results)

    const succeeded = results.filter(r => r.ok).length
    const failed    = results.filter(r => !r.ok).length
    if (succeeded) toast.success(`${succeeded} invite${succeeded > 1 ? 's' : ''} sent!`)
    if (failed)    toast.error(`${failed} invite${failed > 1 ? 's' : ''} failed`)

    if (!failed) {
      // All succeeded — reset
      setBulkRows([{ email: '', role: 'member' }])
      setShowBulk(false)
      router.refresh()
    } else {
      // Keep failed rows for retry
      setBulkRows(bulkRows.filter((r, i) => !results[i]?.ok))
    }
  }

  // ── Role change ────────────────────────────────────────────────────────
  async function changeRole(userId: string, newRole: string) {
    if (!userId || userId === 'undefined') {
      toast.error('Cannot identify member — please refresh and try again.')
      return
    }
    setSaving(userId)
    const res = await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    })
    setSaving(null)
    setRoleEditing(null)
    if (res.ok) { toast.success('Role updated'); router.refresh() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to update role') }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--surface-subtle)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Team</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowBulk(false); setShowInvite(v => !v) }}
                className="btn btn-outline flex items-center gap-2"
              >
                <Mail className="h-4 w-4" /> Invite member
              </button>
              <button
                onClick={() => { setShowInvite(false); setShowBulk(v => !v); setBulkResults([]) }}
                className="btn btn-brand flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" /> Invite multiple
              </button>
            </div>
          )}
        </div>

        {/* Single invite form */}
        {showInvite && (
          <form onSubmit={invite} className="card p-5 mb-6 flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Email address
              </label>
              <input
                type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)}
                placeholder="colleague@company.com" required autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Role</label>
              <select value={invRole} onChange={e => setInvRole(e.target.value as any)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} className="btn btn-brand flex items-center gap-2 disabled:opacity-50">
              <Mail className="h-4 w-4" /> {inviting ? 'Sending…' : 'Send invite'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="btn btn-outline">Cancel</button>
          </form>
        )}

        {/* Bulk invite panel */}
        {showBulk && (
          <div className="card p-5 mb-6">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Invite multiple members</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Add emails one per row, set their role, then send all at once.</p>
              </div>
              <button onClick={() => { setShowBulk(false); setBulkResults([]) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 32px', gap: 8, marginBottom: 6, padding: '0 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</span>
              <span />
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {bulkRows.map((row, i) => {
                const result = bulkResults.find(r => r.email === row.email)
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 32px', gap: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email" value={row.email}
                        onChange={e => updateBulkRow(i, 'email', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBulkRow() } }}
                        placeholder={`email${i + 1}@company.com`}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, outline: 'none',
                          border: `1px solid ${result ? (result.ok ? '#16a34a' : '#dc2626') : 'var(--border)'}`,
                          background: result ? (result.ok ? '#f0fdf4' : '#fef2f2') : 'var(--surface)',
                          color: 'var(--text-primary)', boxSizing: 'border-box',
                        }}
                        onFocus={e => { if (!result) e.currentTarget.style.borderColor = 'var(--brand)' }}
                        onBlur={e => { if (!result) e.currentTarget.style.borderColor = 'var(--border)' }}
                      />
                      {result && (
                        <span style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          fontSize: 11, fontWeight: 600, color: result.ok ? '#16a34a' : '#dc2626',
                        }}>
                          {result.ok ? '✓ Sent' : result.msg}
                        </span>
                      )}
                    </div>
                    <select value={row.role} onChange={e => updateBulkRow(i, 'role', e.target.value as any)}
                      style={{
                        padding: '7px 10px', borderRadius: 8, fontSize: 13, outline: 'none', cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)',
                        fontFamily: 'inherit',
                      }}>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={() => removeBulkRow(i)} disabled={bulkRows.length === 1}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', cursor: bulkRows.length === 1 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', opacity: bulkRows.length === 1 ? 0.4 : 1,
                      }}>
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add row + Send buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={addBulkRow}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent',
                  cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'inherit',
                }}>
                <Plus style={{ width: 14, height: 14 }} /> Add another
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                  {bulkRows.filter(r => r.email.trim()).length} email{bulkRows.filter(r => r.email.trim()).length !== 1 ? 's' : ''}
                </span>
                <button onClick={sendBulk} disabled={bulkSending || !bulkRows.some(r => r.email.trim())}
                  className="btn btn-brand flex items-center gap-2 disabled:opacity-50">
                  <Send style={{ width: 14, height: 14 }} />
                  {bulkSending ? 'Sending…' : 'Send all invites'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="card" style={{ overflow: 'visible' }}>
          {members.map((m, i) => {
            const RoleIcon  = ROLE_ICONS[m.role] ?? User
            const rate      = m.tasks_30d ? Math.round((m.done_30d / m.tasks_30d) * 100) : 0
            const isMe      = m.id === currentUserId
            const isOwner   = m.role === 'owner'
            const isSaving  = saving === m.id
            const isEditing = roleEditing === m.id

            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4"
                style={{ borderBottom: i < members.length - 1 ? '1px solid var(--border-light)' : 'none' }}>

                {/* Avatar */}
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: ROLE_COLORS[m.role] ?? '#94a3b8', fontSize: 15 }}>
                  {m.name?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                    {isMe && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(you)</span>}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                </div>

                {/* Task stats */}
                <div className="hidden md:block text-center w-24">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.done_30d}/{m.tasks_30d}</p>
                  {(m.inprog_30d ?? 0) > 0 && (
                    <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>{m.inprog_30d} in progress</p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>tasks done</p>
                  {m.tasks_30d > 0 && (
                    <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--border-light)' }}>
                      <div className="h-full rounded-full" style={{ width: `${rate}%`, background: 'var(--brand)' }} />
                    </div>
                  )}
                </div>

                {/* Joined date */}
                <div className="hidden md:block text-xs w-20 text-right" style={{ color: 'var(--text-muted)' }}>
                  {fmtDate(m.joined_at)}
                </div>

                {/* Role badge / editable dropdown */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {canManage && !isMe && !isOwner ? (
                    <>
                      <button onClick={() => setRoleEditing(isEditing ? null : m.id)} disabled={isSaving}
                        title="Click to change role"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          border: isEditing ? `1.5px solid ${ROLE_COLORS[m.role]}` : '1.5px dashed var(--border)',
                          color: isSaving ? 'var(--text-muted)' : ROLE_COLORS[m.role],
                          background: isEditing ? `${ROLE_COLORS[m.role]}10` : 'transparent', cursor: 'pointer',
                        }}
                        onMouseEnter={e => { if (!isEditing) { (e.currentTarget as HTMLElement).style.borderColor = ROLE_COLORS[m.role]; (e.currentTarget as HTMLElement).style.background = `${ROLE_COLORS[m.role]}10` } }}
                        onMouseLeave={e => { if (!isEditing) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                      >
                        <RoleIcon className="h-3.5 w-3.5" />
                        {isSaving ? 'Saving…' : m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        <ChevronDown className="h-3 w-3 transition-transform" style={{ color: 'var(--text-muted)', transform: isEditing ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      </button>

                      {isEditing && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setRoleEditing(null)} />
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 6,
                            borderRadius: 12, padding: '4px 0', minWidth: 240,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            boxShadow: '0 16px 40px rgba(0,0,0,0.18)', zIndex: 9999,
                          }}>
                            <p className="px-3 pb-1.5 pt-0.5 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                              Change role
                            </p>
                            {ROLES.map(r => {
                              const Icon = ROLE_ICONS[r] ?? User
                              const isCurrent = r === m.role
                              return (
                                <button key={r} onClick={() => changeRole(m.id, r)}
                                  className="w-full flex items-start gap-2.5 px-3 py-2.5 transition-colors text-left"
                                  style={{ background: isCurrent ? `${ROLE_COLORS[r]}10` : 'transparent', borderBottom: '1px solid var(--border-light)' }}
                                  onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)' }}
                                  onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = isCurrent ? `${ROLE_COLORS[r]}10` : 'transparent' }}
                                >
                                  <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: ROLE_COLORS[r] }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold" style={{ color: isCurrent ? ROLE_COLORS[r] : 'var(--text-primary)' }}>
                                        {r.charAt(0).toUpperCase() + r.slice(1)}
                                      </span>
                                      {isCurrent && <Check className="h-3 w-3" style={{ color: ROLE_COLORS[r] }} />}
                                    </div>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.4 }}>
                                      {ROLE_DESC[r]}
                                    </p>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ color: ROLE_COLORS[m.role], background: `${ROLE_COLORS[m.role]}15` }}>
                      <RoleIcon className="h-3.5 w-3.5" />
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}