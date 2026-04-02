'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Project, Client } from '@/types'
import { cn } from '@/lib/utils/cn'
import { fmtDate } from '@/lib/utils/format'
import {
  Plus, Folder, Users, Calendar, ChevronRight,
  X, Check, User, Search
} from 'lucide-react'

interface Member {
  id: string
  name: string
  avatar_url?: string
  role: string
}

interface Props {
  projects: Project[]
  clients: Client[]
  members: Member[]
  currentUserId: string
  canManage: boolean
  orgId: string
}

export default function ProjectsView({ projects, clients, members, currentUserId, canManage, orgId }: Props) {
  const [search, setSearch] = useState('')
  const [editingMembers, setEditingMembers] = useState<string | null>(null) // projectId being edited
  const [memberSearch, setMemberSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Derive local member assignments (stored in project.custom_fields._members)
  const [localProjects, setLocalProjects] = useState<Project[]>(projects)

  const getProjectMembers = (project: Project): string[] => {
    try {
      const cf = project.custom_fields as Record<string, unknown> | null
      if (!cf) return []
      const m = cf._members
      if (Array.isArray(m)) return m as string[]
    } catch {}
    return []
  }

  // Filter projects: owner always sees, members see if in list, admins see all
  const visibleProjects = useMemo(() => {
    return localProjects.filter(p => {
      const isOwner = p.owner_id === currentUserId
      const projectMembers = getProjectMembers(p)
      const isMember = projectMembers.includes(currentUserId)
      const isAdmin = members.find(m => m.id === currentUserId)?.role === 'admin'
      return isOwner || isMember || isAdmin || projectMembers.length === 0
    })
  }, [localProjects, currentUserId, members])

  const filtered = useMemo(() =>
    visibleProjects.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    ),
    [visibleProjects, search]
  )

  const saveMembers = async (projectId: string, memberIds: string[]) => {
    setSaving(true)
    try {
      const project = localProjects.find(p => p.id === projectId)
      if (!project) return
      const newCf = { ...(project.custom_fields as object ?? {}), _members: memberIds }

      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_fields: newCf }),
      })
      if (!res.ok) throw new Error('Failed to save')

      setLocalProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, custom_fields: newCf } : p
      ))
      setEditingMembers(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700
                       rounded-lg bg-white dark:bg-slate-800 w-64
                       focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {canManage && (
          <Link
            href="/projects/new"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} /> New Project
          </Link>
        )}
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(project => {
          const client = clients.find(c => c.id === project.client_id)
          const projectMemberIds = getProjectMembers(project)
          const projectMembers = members.filter(m => projectMemberIds.includes(m.id))
          const isEditingThis = editingMembers === project.id
          const [pendingMembers, setPendingMembers] = useState<string[]>(projectMemberIds)

          return (
            <div
              key={project.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200
                         dark:border-slate-700 overflow-hidden hover:shadow-md transition-all"
            >
              {/* Card header */}
              <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg flex-shrink-0">
                    <Folder size={16} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm">
                      {project.name}
                    </h3>
                    {client && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {client.name}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-slate-400 hover:text-teal-600 transition-colors flex-shrink-0 ml-2"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>

              {/* Team Members section */}
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Users size={11} /> Team Members
                    {projectMembers.length > 0 && (
                      <span className="bg-slate-100 dark:bg-slate-700 rounded-full px-1.5 text-[10px]">
                        {projectMembers.length}
                      </span>
                    )}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => {
                        setEditingMembers(isEditingThis ? null : project.id)
                        setMemberSearch('')
                      }}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      {isEditingThis ? 'Cancel' : 'Edit'}
                    </button>
                  )}
                </div>

                {!isEditingThis && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {projectMembers.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">All members (no restriction)</span>
                    ) : (
                      projectMembers.map(m => (
                        <MemberChip key={m.id} name={m.name} />
                      ))
                    )}
                  </div>
                )}

                {isEditingThis && (
                  <MemberPicker
                    members={members}
                    selected={projectMemberIds}
                    onSave={(ids) => saveMembers(project.id, ids)}
                    saving={saving}
                    memberSearch={memberSearch}
                    setMemberSearch={setMemberSearch}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t
                              border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  project.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : project.status === 'completed'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                )}>
                  {project.status ?? 'active'}
                </span>
                {project.due_date && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar size={10} />
                    {fmtDate(project.due_date)}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center h-48
                          border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <Folder size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {search ? 'No projects match your search' : 'No projects yet'}
            </p>
            {canManage && !search && (
              <Link
                href="/projects/new"
                className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                Create your first project →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Member Chip ─────────────────────────────────────────────────────────────

function MemberChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-700
                     text-slate-600 dark:text-slate-300 rounded-full px-2 py-0.5">
      <User size={9} />
      {name.split(' ')[0]}
    </span>
  )
}

// ─── Member Picker ────────────────────────────────────────────────────────────

function MemberPicker({
  members, selected, onSave, saving, memberSearch, setMemberSearch
}: {
  members: Member[]
  selected: string[]
  onSave: (ids: string[]) => void
  saving: boolean
  memberSearch: string
  setMemberSearch: (s: string) => void
}) {
  const [localSelected, setLocalSelected] = useState<string[]>(selected)

  const toggle = (id: string) => {
    setLocalSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  )

  return (
    <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
      <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-600">
        <input
          value={memberSearch}
          onChange={e => setMemberSearch(e.target.value)}
          placeholder="Search members..."
          className="w-full text-xs bg-transparent outline-none text-slate-700 dark:text-slate-200"
        />
      </div>
      <div className="max-h-40 overflow-y-auto">
        {filtered.map(m => (
          <button
            key={m.id}
            onClick={() => toggle(m.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50
                       dark:hover:bg-slate-700/50 transition-colors text-left"
          >
            <div className={cn(
              'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
              localSelected.includes(m.id)
                ? 'bg-teal-500 border-teal-500'
                : 'border-slate-300 dark:border-slate-600'
            )}>
              {localSelected.includes(m.id) && <Check size={10} className="text-white" />}
            </div>
            <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{m.name}</span>
            <span className="text-[10px] text-slate-400 ml-auto">{m.role}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t
                      border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
        <span className="text-[11px] text-slate-400">
          {localSelected.length === 0 ? 'No restriction' : `${localSelected.length} selected`}
        </span>
        <button
          onClick={() => onSave(localSelected)}
          disabled={saving}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded-lg
                     font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
