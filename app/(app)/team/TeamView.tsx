'use client'
import { useState }   from 'react'
import { useRouter }  from 'next/navigation'
import { UserPlus, Mail, Crown, Shield, User, ChevronDown } from 'lucide-react'
import { cn }         from '@/lib/utils/cn'
import { toast }      from '@/store/appStore'
import { fmtDate }    from '@/lib/utils/format'

const ROLES = ['owner','admin','manager','member','viewer'] as const
const ROLE_ICONS: Record<string, any> = { owner: Crown, admin: Shield, manager: UserPlus, member: User, viewer: User }
const ROLE_COLORS: Record<string, string> = {
  owner: '#ca8a04', admin: '#7c3aed', manager: '#0d9488', member: '#64748b', viewer: '#94a3b8'
}

interface Member { id:string; name:string; email:string; avatar_url:string|null; role:string; joined_at:string; tasks_30d:number; done_30d:number; inprog_30d?:number }

export function TeamView({ members, canManage, currentUserId }: { members:Member[]; canManage:boolean; currentUserId:string }) {
  const router  = useRouter()
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail,   setInvEmail]   = useState('')
  const [invRole,    setInvRole]    = useState<'manager'|'member'|'viewer'>('member')
  const [inviting,   setInviting]   = useState(false)
  const [roleEditing,setRoleEditing]= useState<string|null>(null)

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
    if (res.ok) { toast.success('Invite sent!'); setInvEmail(''); setShowInvite(false); router.refresh() }
    else { toast.error(d.error ?? 'Failed to invite') }
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    })
    setRoleEditing(null)
    if (res.ok) { toast.success('Role updated'); router.refresh() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--surface-subtle)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="text-sm text-gray-400 mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          {canManage && (
            <button onClick={() => setShowInvite(v => !v)}
              className="btn btn-brand flex items-center gap-2">
              <UserPlus className="h-4 w-4"/> Invite member
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && (
          <form onSubmit={invite} className="card p-5 mb-6 flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Email address</label>
              <input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)}
                placeholder="colleague@company.com" required
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                style={{ borderColor: 'var(--border)' }}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Role</label>
              <select value={invRole} onChange={e => setInvRole(e.target.value as any)}
                className="px-3 py-2 border rounded-lg text-sm outline-none bg-white focus:border-teal-400"
                style={{ borderColor: 'var(--border)' }}>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} className="btn btn-brand flex items-center gap-2 disabled:opacity-50">
              <Mail className="h-4 w-4"/> {inviting ? 'Sending…' : 'Send invite'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="btn btn-outline">Cancel</button>
          </form>
        )}

        {/* Members list */}
        <div className="card overflow-hidden">
          {members.map((m, i) => {
            const RoleIcon = ROLE_ICONS[m.role] ?? User
            const rate = m.tasks_30d ? Math.round((m.done_30d / m.tasks_30d) * 100) : 0
            return (
              <div key={m.id} className={cn('flex items-center gap-4 px-5 py-4', i < members.length-1 && 'border-b')}
                style={{ borderColor: 'var(--border)' }}>
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: ROLE_COLORS[m.role] ?? '#94a3b8', fontSize: 15 }}>
                  {m.name[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900">{m.name}</span>
                    {m.id === currentUserId && <span className="text-xs text-gray-400">(you)</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>

                {/* Tasks 30d */}
                <div className="hidden md:block text-center w-24">
                  <p className="text-sm font-semibold text-gray-900">{m.done_30d}/{m.tasks_30d}</p>
                  {(m.inprog_30d ?? 0) > 0 && <p className="text-xs text-teal-600 font-medium">{m.inprog_30d} in progress</p>}
                  <p className="text-xs text-gray-400">tasks done</p>
                  {m.tasks_30d > 0 && (
                    <div className="h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${rate}%`, background: '#0d9488' }}/>
                    </div>
                  )}
                </div>

                {/* Joined */}
                <div className="hidden md:block text-xs text-gray-400 w-20 text-right">
                  {fmtDate(m.joined_at)}
                </div>

                {/* Role */}
                <div className="relative flex-shrink-0">
                  {canManage && m.id !== currentUserId ? (
                    <button onClick={() => setRoleEditing(roleEditing === m.id ? null : m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors hover:bg-gray-50"
                      style={{ borderColor: 'var(--border)', color: ROLE_COLORS[m.role] }}>
                      <RoleIcon className="h-3.5 w-3.5"/>
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      <ChevronDown className="h-3 w-3 text-gray-400"/>
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ color: ROLE_COLORS[m.role], background: ROLE_COLORS[m.role]+'15' }}>
                      <RoleIcon className="h-3.5 w-3.5"/>
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </span>
                  )}
                  {roleEditing === m.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-xl shadow-xl py-1 z-20 min-w-[140px]"
                      style={{ borderColor: 'var(--border)' }}>
                      {ROLES.filter(r => r !== 'owner').map(r => (
                        <button key={r} onClick={() => changeRole(m.id, r)}
                          className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-50 transition-colors', r === m.role && 'bg-teal-50 text-teal-700')}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
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
