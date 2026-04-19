'use client'
import { useState, useTransition } from 'react'
import { useRouter }  from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { Avatar, RoleBadge } from '@/components/ui/Badge'
import { toast }      from '@/store/appStore'

interface Member { id: string; role: string; joined_at: string; user_id: string; can_view_all_tasks: boolean; can_view_monitor: boolean; users: { id: string; name: string; email: string; avatar_url: string | null } | null }
interface Props { members: Member[]; currentUserId: string; isAdmin: boolean }

const ROLES = ['admin','manager','member','viewer']

export function MembersView({ members, currentUserId, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startT] = useTransition()
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState('member')
  const [sending, setSending] = useState(false)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    const res = await fetch('/api/team', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    const data = await res.json()
    setSending(false)
    if (res.ok) { toast.success(data.message ?? 'Invitation sent!'); setEmail(''); startT(() => router.refresh()) }
    else toast.error(data.error ?? 'Failed to invite')
  }

  async function changeRole(memberId: string, newRole: string) {
    const res = await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, role: newRole }),
    })
    if (res.ok) { toast.success('Role updated'); startT(() => router.refresh()) }
    else toast.error('Failed to update role')
  }

  async function toggleViewAll(memberId: string, current: boolean) {
    const res = await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, can_view_all_tasks: !current }),
    })
    if (res.ok) { toast.success(!current ? 'View all tasks enabled' : 'View all tasks disabled'); startT(() => router.refresh()) }
    else toast.error('Failed to update permission')
  }

  async function toggleMonitor(memberId: string, current: boolean) {
    const res = await fetch('/api/team', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, can_view_monitor: !current }),
    })
    if (res.ok) { toast.success(!current ? 'Monitor access granted' : 'Monitor access revoked'); startT(() => router.refresh()) }
    else toast.error('Failed to update permission')
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this member?')) return
    // Soft remove via PATCH is_active = false
    const res = await fetch(`/api/team`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, is_active: false }),
    })
    if (res.ok) { toast.success('Member removed'); startT(() => router.refresh()) }
    else toast.error('Failed to remove member')
  }

  return (
    <div>
      {/* Invite form */}
      {isAdmin && (
        <form onSubmit={invite} className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-teal-600"/> Invite a team member
          </h2>
          <div className="flex gap-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input flex-1" placeholder="colleague@company.com" required/>
            <select value={role} onChange={e => setRole(e.target.value)} className="input w-32">
              {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
            <button type="submit" disabled={sending} className="btn btn-brand px-5">
              {sending ? 'Sending...' : 'Invite'}
            </button>
          </div>
        </form>
      )}

      {/* Members list */}
      <div className="card-elevated overflow-hidden">
        {members.map(m => {
          const profile = m.users
          const isMe    = m.user_id === currentUserId
          return (
            <div key={m.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <Avatar name={profile?.name ?? 'U'} size="md"/>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{profile?.name}{isMe && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}</p>
                <p className="text-xs text-gray-400">{profile?.email}</p>
              </div>
              {isAdmin && !isMe ? (
                <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-teal-400 text-gray-700">
                  {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
              ) : (
                <RoleBadge role={m.role}/>
              )}
              {/* View all tasks toggle — only for non-owner/admin members */}
              {isAdmin && !isMe && !['owner','admin'].includes(m.role) && (
                <button
                  onClick={() => toggleViewAll(m.id, m.can_view_all_tasks)}
                  title={m.can_view_all_tasks ? 'Click to revoke "View all tasks"' : 'Click to grant "View all tasks"'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                    borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${m.can_view_all_tasks ? '#0d9488' : '#e2e8f0'}`,
                    background: m.can_view_all_tasks ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle, #f8fafc)',
                    color: m.can_view_all_tasks ? '#0d9488' : '#94a3b8',
                    fontFamily: 'inherit', transition: 'all 0.12s', whiteSpace: 'nowrap',
                  }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: m.can_view_all_tasks ? '#0d9488' : '#cbd5e1',
                    display: 'inline-block',
                  }}/>
                  View all tasks
                </button>
              )}
              {/* Monitor access toggle — grants access to the Monitor analytics page */}
              {isAdmin && !isMe && !['owner','admin'].includes(m.role) && (
                <button
                  onClick={() => toggleMonitor(m.id, m.can_view_monitor)}
                  title={m.can_view_monitor ? 'Click to revoke Monitor access' : 'Click to grant Monitor access'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                    borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${m.can_view_monitor ? '#7c3aed' : '#e2e8f0'}`,
                    background: m.can_view_monitor ? 'rgba(124,58,237,0.08)' : 'var(--surface-subtle, #f8fafc)',
                    color: m.can_view_monitor ? '#7c3aed' : '#94a3b8',
                    fontFamily: 'inherit', transition: 'all 0.12s', whiteSpace: 'nowrap',
                  }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: m.can_view_monitor ? '#7c3aed' : '#cbd5e1',
                    display: 'inline-block',
                  }}/>
                  Monitor
                </button>
              )}
              {isAdmin && !isMe && (
                <button onClick={() => removeMember(m.id)} className="h-7 w-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <X className="h-4 w-4"/>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
