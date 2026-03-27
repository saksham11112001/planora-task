'use client'
import { useState }   from 'react'
import { useRouter }  from 'next/navigation'
import { UserPlus, Mail, Crown, Shield, User, ChevronDown, Check } from 'lucide-react'
import { cn }         from '@/lib/utils/cn'
import { toast }      from '@/store/appStore'
import { fmtDate }    from '@/lib/utils/format'

const ROLES = ['admin','manager','member','viewer'] as const
const ROLE_ICONS: Record<string, any> = { owner: Crown, admin: Shield, manager: UserPlus, member: User, viewer: User }
const ROLE_COLORS: Record<string, string> = {
  owner: '#ca8a04', admin: '#7c3aed', manager: '#0d9488', member: '#64748b', viewer: '#94a3b8'
}

interface Member {
  id: string          // users.id  (the UUID we send to API as user_id)
  name: string
  email: string
  avatar_url: string | null
  role: string
  joined_at: string
  tasks_30d: number
  done_30d: number
  inprog_30d?: number
}

export function TeamView({
  members,
  canManage,
  currentUserId,
}: {
  members: Member[]
  canManage: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail,   setInvEmail]   = useState('')
  const [invRole,    setInvRole]    = useState<'manager' | 'member' | 'viewer'>('member')
  const [inviting,   setInviting]   = useState(false)
  const [roleEditing,setRoleEditing]= useState<string | null>(null)
  const [saving,     setSaving]     = useState<string | null>(null)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!invEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  async function changeRole(userId: string, newRole: string) {
    // Guard: userId must be a valid non-empty string (not 'undefined' or '')
    if (!userId || userId === 'undefined') {
      toast.error('Cannot identify member — please refresh and try again.')
      return
    }
    setSaving(userId)
    const res = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    })
    setSaving(null)
    setRoleEditing(null)
    if (res.ok) {
      toast.success('Role updated')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to update role')
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
            <button
              onClick={() => setShowInvite(v => !v)}
              className="btn btn-brand flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" /> Invite member
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && (
          <form
            onSubmit={invite}
            className="card p-5 mb-6 flex gap-3 items-end flex-wrap"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Email address
              </label>
              <input
                type="email"
                value={invEmail}
                onChange={e => setInvEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Role
              </label>
              <select
                value={invRole}
                onChange={e => setInvRole(e.target.value as any)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="manager">Manager</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="btn btn-brand flex items-center gap-2 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" /> {inviting ? 'Sending…' : 'Send invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="btn btn-outline"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Members list */}
        <div className="card" style={{ overflow: "visible" }}>
          {members.map((m, i) => {
            const RoleIcon = ROLE_ICONS[m.role] ?? User
            const rate = m.tasks_30d ? Math.round((m.done_30d / m.tasks_30d) * 100) : 0
            const isMe = m.id === currentUserId
            const isOwner = m.role === 'owner'
            const isSaving = saving === m.id
            const isEditing = roleEditing === m.id

            return (
              <div
                key={m.id}
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  borderBottom: i < members.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}
              >
                {/* Avatar */}
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: ROLE_COLORS[m.role] ?? '#94a3b8', fontSize: 15 }}
                >
                  {m.name?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {m.name}
                    </span>
                    {isMe && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(you)</span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                </div>

                {/* Task stats */}
                <div className="hidden md:block text-center w-24">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {m.done_30d}/{m.tasks_30d}
                  </p>
                  {(m.inprog_30d ?? 0) > 0 && (
                    <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>
                      {m.inprog_30d} in progress
                    </p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>tasks done</p>
                  {m.tasks_30d > 0 && (
                    <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--border-light)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${rate}%`, background: 'var(--brand)' }}
                      />
                    </div>
                  )}
                </div>

                {/* Joined date */}
                <div className="hidden md:block text-xs w-20 text-right" style={{ color: 'var(--text-muted)' }}>
                  {fmtDate(m.joined_at)}
                </div>

                {/* Role badge / editable dropdown */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {canManage && !isMe && !isOwner ? (
                    <>
                      <button
                        onClick={() => setRoleEditing(isEditing ? null : m.id)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                        style={{
                          borderColor: 'var(--border)',
                          color: isSaving ? 'var(--text-muted)' : ROLE_COLORS[m.role],
                          background: isEditing ? 'var(--surface-subtle)' : 'transparent',
                        }}
                      >
                        <RoleIcon className="h-3.5 w-3.5" />
                        {isSaving ? 'Saving…' : m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        <ChevronDown
                          className="h-3 w-3 transition-transform"
                          style={{
                            color: 'var(--text-muted)',
                            transform: isEditing ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        />
                      </button>

                      {isEditing && (
                        <>
                          {/* Click-outside backdrop */}
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                            onClick={() => setRoleEditing(null)}
                          />
                          <div
                            style={{
                              position: 'absolute', right: 0, top: '100%', marginTop: 6,
                              borderRadius: 12, padding: '4px 0', minWidth: 160,
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                              zIndex: 9999,
                            }}
                          >
                            <p className="px-3 pb-1.5 pt-0.5 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                              Change role
                            </p>
                            {ROLES.map(r => {
                              const Icon = ROLE_ICONS[r] ?? User
                              const isCurrent = r === m.role
                              return (
                                <button
                                  key={r}
                                  onClick={() => changeRole(m.id, r)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors"
                                  style={{
                                    color: isCurrent ? ROLE_COLORS[r] : 'var(--text-primary)',
                                    background: isCurrent ? `${ROLE_COLORS[r]}12` : 'transparent',
                                    fontWeight: isCurrent ? 600 : 400,
                                  }}
                                  onMouseEnter={e => {
                                    if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'
                                  }}
                                  onMouseLeave={e => {
                                    if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent'
                                  }}
                                >
                                  <Icon className="h-3.5 w-3.5" style={{ color: ROLE_COLORS[r] }} />
                                  {r.charAt(0).toUpperCase() + r.slice(1)}
                                  {isCurrent && <Check className="h-3 w-3 ml-auto" style={{ color: ROLE_COLORS[r] }} />}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    /* Non-editable badge (owner, self, or viewer-level viewer) */
                    <span
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        color: ROLE_COLORS[m.role],
                        background: `${ROLE_COLORS[m.role]}15`,
                      }}
                    >
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
