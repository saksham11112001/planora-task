'use client'
import { useState, useTransition } from 'react'
import { useRouter }  from 'next/navigation'
import { UserPlus, X, Copy, Check, RefreshCw, Share2, Gift } from 'lucide-react'
import { Avatar, RoleBadge } from '@/components/ui/Badge'
import { toast }      from '@/store/appStore'

interface Member { id: string; role: string; joined_at: string; user_id: string; can_view_all_tasks: boolean; can_view_monitor: boolean; users: { id: string; name: string; email: string; avatar_url: string | null } | null }
interface Props { members: Member[]; currentUserId: string; isAdmin: boolean; joinCode?: string | null; referralCode?: string | null; referralExtensionDays?: number }

const ROLES = ['admin','manager','member','viewer']

export function MembersView({ members, currentUserId, isAdmin, joinCode: initialJoinCode, referralCode, referralExtensionDays = 0 }: Props) {
  const router = useRouter()
  const [isPending, startT] = useTransition()
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState('member')
  const [sending, setSending] = useState(false)
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? null)
  const [copiedJoin, setCopiedJoin]       = useState(false)
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [rotating, setRotating] = useState(false)

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
    const res = await fetch(`/api/team`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, is_active: false }),
    })
    if (res.ok) { toast.success('Member removed'); startT(() => router.refresh()) }
    else toast.error('Failed to remove member')
  }

  function fmtCode(code: string | null) {
    if (!code) return ''
    const c = code.replace(/-/g, '')
    return c.length === 8 ? `${c.slice(0,4)}-${c.slice(4)}` : code
  }

  function copyJoinCode() {
    if (!joinCode) return
    navigator.clipboard.writeText(joinCode).then(() => { setCopiedJoin(true); setTimeout(() => setCopiedJoin(false), 2000) })
  }

  function copyReferralCode() {
    if (!referralCode) return
    navigator.clipboard.writeText(referralCode).then(() => { setCopiedReferral(true); setTimeout(() => setCopiedReferral(false), 2000) })
  }

  async function rotateJoinCode() {
    if (!confirm('Rotate the join code? The old code will stop working immediately.')) return
    setRotating(true)
    const res = await fetch('/api/org/rotate-join-code', { method: 'POST' })
    const data = await res.json()
    setRotating(false)
    if (res.ok) { setJoinCode(data.join_code); toast.success('Join code rotated') }
    else toast.error(data.error ?? 'Failed to rotate code')
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

      {/* Join code + Referral code */}
      <div className="card p-5 mb-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Share2 className="h-4 w-4 text-teal-600"/> Organisation codes
        </h2>

        {/* Join code */}
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            Join code
            <span className="font-normal text-gray-400">— share this with anyone you want to invite</span>
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-sm tracking-widest bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 select-all">
              {joinCode ? fmtCode(joinCode) : <span className="text-gray-400 tracking-normal">No code generated</span>}
            </div>
            <button onClick={copyJoinCode} disabled={!joinCode}
              title={copiedJoin ? 'Copied!' : 'Copy join code'}
              className="btn btn-outline px-3 py-2 flex items-center gap-1.5 text-xs">
              {copiedJoin ? <Check className="h-3.5 w-3.5 text-teal-600"/> : <Copy className="h-3.5 w-3.5"/>}
              {copiedJoin ? 'Copied' : 'Copy'}
            </button>
            {isAdmin && (
              <button onClick={rotateJoinCode} disabled={rotating}
                title="Generate a new join code (invalidates the current one)"
                className="btn btn-outline px-3 py-2 flex items-center gap-1.5 text-xs text-gray-500">
                <RefreshCw className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`}/>
                Rotate
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Members who join via this code get the &ldquo;member&rdquo; role. You can change their role afterwards.
          </p>
        </div>

        {/* Referral code */}
        {referralCode && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-violet-500"/> Referral code
              <span className="font-normal text-gray-400">— when a new org uses this at signup, your trial extends by 7 days</span>
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm tracking-widest bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 select-all">
                {fmtCode(referralCode)}
              </div>
              <button onClick={copyReferralCode}
                title={copiedReferral ? 'Copied!' : 'Copy referral code'}
                className="btn btn-outline px-3 py-2 flex items-center gap-1.5 text-xs">
                {copiedReferral ? <Check className="h-3.5 w-3.5 text-teal-600"/> : <Copy className="h-3.5 w-3.5"/>}
                {copiedReferral ? 'Copied' : 'Copy'}
              </button>
            </div>
            {referralExtensionDays > 0 && (
              <p className="mt-1.5 text-xs text-violet-600 font-medium">
                +{referralExtensionDays} day{referralExtensionDays !== 1 ? 's' : ''} earned from referrals so far
              </p>
            )}
          </div>
        )}
      </div>

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
