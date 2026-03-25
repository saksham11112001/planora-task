'use client'
import { useState, useTransition } from 'react'
import { useRouter }  from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { Avatar, RoleBadge } from '@/components/ui/Badge'
import { toast }      from '@/store/appStore'

interface Member { id: string; role: string; joined_at: string; user_id: string; users: { id: string; name: string; email: string; avatar_url: string | null } | null }
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
