'use client'
import { useState }   from 'react'
import { useRouter }  from 'next/navigation'
import { UserPlus, Mail, Crown, Shield, User, ChevronDown, Check, Plus, X, Send, Pencil } from 'lucide-react'
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
  phone_number?: string | null
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
  const [removingId,  setRemovingId]  = useState<string | null>(null)  // user_id being removed
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null) // user_id in confirm state

  // Edit member info
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editName,      setEditName]      = useState('')
  const [editPhone,     setEditPhone]     = useState('')
  const [editSaving,    setEditSaving]    = useState(false)

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

  // ── Remove member ──────────────────────────────────────────────────────
  async function removeMember(userId: string, memberName: string) {
    // Two-step confirm: first click shows confirm state, second click executes
    if (removeConfirm !== userId) {
      setRemoveConfirm(userId)
      // Auto-reset after 4 seconds if user doesn't confirm
      setTimeout(() => setRemoveConfirm(c => c === userId ? null : c), 4000)
      return
    }
    setRemovingId(userId)
    setRemoveConfirm(null)
    const res = await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, is_active: false }),
    })
    setRemovingId(null)
    if (res.ok) {
      toast.success(`${memberName} removed from the workspace`)
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed to remove member')
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

  // ── Edit member info ───────────────────────────────────────────────────
  function openEditMember(m: Member) {
    setEditingMember(m)
    setEditName(m.name)
    setEditPhone(m.phone_number ?? '')
  }

  async function saveMemberEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMember || !editName.trim()) return
    setEditSaving(true)
    const res = await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: editingMember.id, name: editName.trim(), phone_number: editPhone.trim() || null }),
    })
    setEditSaving(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Member info updated')
      setEditingMember(null)
      router.refresh()
    } else {
      toast.error(d.error ?? 'Failed to update member')
    }
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

                {/* Edit member info — owner/admin only, not self, not other owners */}
                {canManage && !isMe && !isOwner && (
                  <div style={{ marginLeft: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => openEditMember(m)}
                      title="Edit member info"
                      style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                        background: 'var(--surface-subtle)', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                        transition: 'all 0.15s', flexShrink: 0 }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = '#eff6ff'
                        ;(e.currentTarget as HTMLElement).style.borderColor = '#bfdbfe'
                        ;(e.currentTarget as HTMLElement).style.color = '#2563eb'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                      }}>
                      <Pencil style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                )}

                {/* Remove member button — owners/admins only, not self, not other owners */}
                {canManage && !isMe && !isOwner && (
                  <div style={{ marginLeft: 8, flexShrink: 0 }}>
                    {removeConfirm === m.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>Remove?</span>
                        <button
                          onClick={() => removeMember(m.id, m.name)}
                          disabled={removingId === m.id}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none',
                            background: '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          {removingId === m.id ? '…' : 'Yes, remove'}
                        </button>
                        <button onClick={() => setRemoveConfirm(null)}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => removeMember(m.id, m.name)}
                        title="Remove member"
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                          background: 'var(--surface-subtle)', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                          transition: 'all 0.15s', flexShrink: 0 }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = '#fef2f2'
                          ;(e.currentTarget as HTMLElement).style.borderColor = '#fecaca'
                          ;(e.currentTarget as HTMLElement).style.color = '#dc2626'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'
                          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                        }}>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M9.5 3.5L7 6M7 6L4.5 3.5M7 6L4.5 8.5M7 6L9.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Edit member modal */}
        {editingMember && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onClick={() => !editSaving && setEditingMember(null)}>
            <div onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)', borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
                padding: '28px 28px 22px', width: 420, maxWidth: '92vw',
                border: '1px solid var(--border)',
              }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: ROLE_COLORS[editingMember.role] ?? '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                    {editingMember.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Edit member</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{editingMember.email}</p>
                  </div>
                </div>
                <button onClick={() => setEditingMember(null)} disabled={editSaving}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={saveMemberEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Full name
                  </label>
                  <input
                    type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    required autoFocus placeholder="e.g. Ravi Kumar"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, outline: 'none',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Phone number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <input
                    type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, outline: 'none',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingMember(null)} disabled={editSaving}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-secondary)', fontSize: 13,
                      fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: editSaving ? 0.5 : 1 }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={editSaving || !editName.trim()}
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: editSaving || !editName.trim() ? 0.6 : 1 }}>
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Empty state */}
        {members.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
            No team members yet. Invite your colleagues above.
          </div>
        )}

        {/* ── Workload / Capacity View ── */}
        {members.length > 0 && <WorkloadView members={members}/>}

      </div>
    </div>
  )
}

// ── Workload panel ────────────────────────────────────────────────────────────
function WorkloadView({ members }: { members: Member[] }) {
  const maxTasks = Math.max(...members.map(m => m.tasks_30d), 1)

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Staff Workload</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--surface-subtle)', borderRadius: 20, border: '1px solid var(--border-light)' }}>last 30 days</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {members.map(m => {
          const completionRate = m.tasks_30d > 0 ? Math.round((m.done_30d / m.tasks_30d) * 100) : 0
          const inProg         = m.inprog_30d ?? 0
          const pending        = m.tasks_30d - m.done_30d - inProg
          const loadPct        = Math.min(100, Math.round((m.tasks_30d / maxTasks) * 100))
          // Capacity indicator: >80% = overloaded, 50-80% = good, <50% = available
          const capacity = loadPct > 80 ? 'high' : loadPct > 40 ? 'medium' : 'low'
          const capColor = capacity === 'high' ? '#dc2626' : capacity === 'medium' ? '#ca8a04' : '#16a34a'
          const capLabel = capacity === 'high' ? 'High load' : capacity === 'medium' ? 'Moderate' : 'Available'
          const RoleIcon = ROLE_ICONS[m.role] ?? User

          return (
            <div key={m.id} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 16, transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>

              {/* Member header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: ROLE_COLORS[m.role] ?? '#0d9488',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {m.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                    <RoleIcon style={{ width: 10, height: 10, color: ROLE_COLORS[m.role] }}/>
                    <span style={{ fontSize: 10, color: ROLE_COLORS[m.role], fontWeight: 600, textTransform: 'capitalize' }}>{m.role}</span>
                  </div>
                </div>
                {/* Capacity badge */}
                <div style={{ padding: '3px 8px', borderRadius: 20, background: `${capColor}12`, border: `1px solid ${capColor}30`, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: capColor }}/>
                  <span style={{ fontSize: 10, fontWeight: 600, color: capColor }}>{capLabel}</span>
                </div>
              </div>

              {/* Load bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Task load</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{m.tasks_30d} tasks</span>
                </div>
                <div style={{ height: 7, background: 'var(--surface-subtle)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: capColor, width: `${loadPct}%`, transition: 'width 0.4s ease' }}/>
                </div>
              </div>

              {/* Task breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { label: 'Done',       value: m.done_30d,   color: '#16a34a', bg: '#dcfce7' },
                  { label: 'In progress',value: inProg,       color: '#0891b2', bg: '#e0f2fe' },
                  { label: 'Pending',    value: Math.max(0, pending), color: '#64748b', bg: '#f1f5f9' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: s.bg }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 9, color: s.color, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Completion rate */}
              {m.tasks_30d > 0 && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Completion rate</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--surface-subtle)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: '#16a34a', width: `${completionRate}%` }}/>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>{completionRate}%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}