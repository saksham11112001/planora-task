'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Avatar } from '@/components/ui/Badge'
import {
  UserMinus, ShieldCheck, Shield, User, Crown,
  AlertTriangle, X, Check, Mail, Phone, MoreVertical
} from 'lucide-react'

interface Member {
  id: string
  user_id: string
  role: 'admin' | 'manager' | 'member' | 'viewer'
  users: {
    id: string
    email: string
    full_name: string
    avatar_url?: string
    phone?: string
  }
  joined_at?: string
}

interface Props {
  members: Member[]
  currentUserId: string
  currentRole: string
  orgId: string
}

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: Crown, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  manager: { label: 'Manager', icon: ShieldCheck, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
  member: { label: 'Member', icon: User, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-700' },
  viewer: { label: 'Viewer', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
}

export default function TeamView({ members: initialMembers, currentUserId, currentRole, orgId }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const canManage = currentRole === 'admin'

  const handleRoleChange = async (memberId: string, userId: string, newRole: string) => {
    setSavingRole(memberId)
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole, org_id: orgId }),
      })
      if (!res.ok) throw new Error('Failed to update role')

      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role: newRole as Member['role'] } : m
      ))
      setEditingRole(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingRole(null)
    }
  }

  const handleRemove = async () => {
    if (!confirmRemove) return
    setRemoving(true)
    try {
      const res = await fetch('/api/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: confirmRemove.user_id, org_id: orgId }),
      })
      if (!res.ok) throw new Error('Failed to remove member')

      setMembers(prev => prev.filter(m => m.id !== confirmRemove.id))
      setConfirmRemove(null)
    } catch (err) {
      console.error(err)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header stats */}
      <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl
                      border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <User size={16} className="text-teal-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{members.length}</p>
            <p className="text-xs text-slate-500">Team Members</p>
          </div>
        </div>
        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const count = members.filter(m => m.role === role).length
          if (count === 0) return null
          const Icon = cfg.icon
          return (
            <div key={role} className="flex items-center gap-1.5">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1', cfg.bg, cfg.color)}>
                <Icon size={10} /> {count} {cfg.label}{count > 1 ? 's' : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Member list */}
      <div className="flex flex-col gap-2">
        {members.map(member => {
          const isMe = member.user_id === currentUserId
          const roleCfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member
          const RoleIcon = roleCfg.icon
          const isEditing = editingRole === member.id

          return (
            <div
              key={member.id}
              className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-slate-800
                         border border-slate-200 dark:border-slate-700 rounded-xl
                         hover:shadow-sm transition-all"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {member.users.avatar_url ? (
                  <img
                    src={member.users.avatar_url}
                    alt={member.users.full_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-orange-400
                                  flex items-center justify-center text-white font-bold text-sm">
                    {(member.users.full_name || member.users.email || '?')[0].toUpperCase()}
                  </div>
                )}
                {isMe && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500
                                  rounded-full border-2 border-white dark:border-slate-800" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {member.users.full_name || 'Unknown'}
                    {isMe && <span className="text-xs text-teal-600 ml-1.5">(you)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Mail size={10} />
                    {member.users.email}
                  </span>
                  {member.users.phone && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone size={10} />
                      {member.users.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Role badge / editor */}
              <div className="flex-shrink-0">
                {isEditing ? (
                  <select
                    defaultValue={member.role}
                    disabled={!!savingRole}
                    onChange={e => handleRoleChange(member.id, member.user_id, e.target.value)}
                    className="text-xs border border-slate-300 dark:border-slate-600 rounded-lg
                               px-2 py-1.5 bg-white dark:bg-slate-700 focus:outline-none
                               focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span
                    onClick={() => canManage && !isMe && setEditingRole(member.id)}
                    className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1',
                      roleCfg.bg, roleCfg.color,
                      canManage && !isMe && 'cursor-pointer hover:opacity-80 border border-dashed border-current/30',
                    )}
                    title={canManage && !isMe ? 'Click to change role' : undefined}
                  >
                    <RoleIcon size={10} />
                    {roleCfg.label}
                  </span>
                )}
              </div>

              {/* Actions menu */}
              {canManage && !isMe && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <MoreVertical size={15} className="text-slate-400" />
                  </button>

                  {openMenu === member.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenu(null)}
                      />
                      <div className="absolute right-0 top-8 z-20 bg-white dark:bg-slate-800
                                      border border-slate-200 dark:border-slate-700 rounded-xl
                                      shadow-lg py-1 min-w-[160px]">
                        <button
                          onClick={() => {
                            setEditingRole(member.id)
                            setOpenMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700
                                     dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <Shield size={14} /> Change Role
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                        <button
                          onClick={() => {
                            setConfirmRemove(member)
                            setOpenMenu(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600
                                     hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <UserMinus size={14} /> Remove Member
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirm remove modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmRemove(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
                          border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30
                              flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Remove Team Member</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 mb-6">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {confirmRemove.users.full_name || confirmRemove.users.email}
              </span>{' '}
              from the team? They will lose access to all projects and tasks.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                disabled={removing}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                           border border-slate-300 dark:border-slate-600 rounded-lg
                           hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600
                           hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {removing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <UserMinus size={14} /> Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
