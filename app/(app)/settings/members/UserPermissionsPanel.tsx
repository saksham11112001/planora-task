'use client'
import { useState } from 'react'
import { X, Check, RotateCcw, Save, Info } from 'lucide-react'
import { toast } from '@/store/appStore'
import type { RolePermissions } from '@/lib/hooks/useOrgSettings'

// ─── Feature catalogue (mirrors PermissionsView.tsx) ─────────────────────────

const FEATURE_GROUPS = [
  {
    group: 'Tasks', color: '#0d9488',
    features: [
      { key: 'tasks.create',       label: 'Create tasks',            desc: 'Add new one-time tasks' },
      { key: 'tasks.edit',         label: 'Edit any task',           desc: 'Edit tasks assigned to others' },
      { key: 'tasks.edit_own',     label: 'Edit own tasks',          desc: 'Edit tasks assigned to themselves' },
      { key: 'tasks.delete',       label: 'Delete tasks',            desc: 'Move tasks to trash' },
      { key: 'tasks.complete',     label: 'Complete tasks',          desc: 'Mark tasks as done' },
      { key: 'tasks.bulk_actions', label: 'Bulk complete/delete',    desc: 'Act on multiple tasks at once' },
      { key: 'tasks.assign',       label: 'Assign tasks to others',  desc: 'Set assignee to another member' },
      { key: 'tasks.approve',      label: 'Approve tasks',           desc: 'Approve tasks in review state' },
      { key: 'tasks.view_all',     label: 'View all tasks',          desc: 'See every task in the org, not just assigned ones' },
      { key: 'tasks.view_my',      label: 'View my tasks only',      desc: 'Can only see tasks assigned to themselves' },
    ],
  },
  {
    group: 'Projects', color: '#7c3aed',
    features: [
      { key: 'projects.create',    label: 'Create projects',         desc: 'Start new projects' },
      { key: 'projects.edit',      label: 'Edit projects',           desc: 'Rename, recolour, change settings' },
      { key: 'projects.delete',    label: 'Delete projects',         desc: 'Archive or delete a project' },
      { key: 'projects.view_all',  label: 'View all projects',       desc: 'See projects they are not a member of' },
    ],
  },
  {
    group: 'Clients', color: '#0891b2',
    features: [
      { key: 'clients.create',     label: 'Create clients',          desc: 'Add new client records' },
      { key: 'clients.edit',       label: 'Edit clients',            desc: 'Update client details' },
      { key: 'clients.delete',     label: 'Delete clients',          desc: 'Remove client records' },
      { key: 'clients.view',       label: 'View clients',            desc: 'See client list and details' },
    ],
  },
  {
    group: 'Recurring tasks', color: '#ea580c',
    features: [
      { key: 'recurring.create',   label: 'Create recurring tasks',  desc: 'Set up repeating task schedules' },
      { key: 'recurring.edit',     label: 'Edit recurring tasks',    desc: 'Change frequency, assignee etc.' },
      { key: 'recurring.delete',   label: 'Delete recurring tasks',  desc: 'Remove a recurring task' },
    ],
  },
  {
    group: 'Reports & time', color: '#ca8a04',
    features: [
      { key: 'reports.view_own',   label: 'View own reports',        desc: 'See their own performance stats' },
      { key: 'reports.view_all',   label: 'View all reports',        desc: 'See reports for the whole team' },
      { key: 'time.log',           label: 'Log time',                desc: 'Add time entries to tasks' },
      { key: 'time.view_all',      label: 'View all time logs',      desc: 'See time logs for all members' },
    ],
  },
  {
    group: 'Team & settings', color: '#db2777',
    features: [
      { key: 'team.invite',        label: 'Invite members',          desc: 'Send invite emails to new users' },
      { key: 'team.remove',        label: 'Remove members',          desc: 'Deactivate team member access' },
      { key: 'team.change_role',   label: 'Change member roles',     desc: 'Promote or demote team members' },
      { key: 'settings.org',       label: 'Edit org settings',       desc: 'Change org name, logo, colour' },
      { key: 'settings.tasks',     label: 'Edit task field settings', desc: 'Show/hide and set mandatory fields' },
    ],
  },
  {
    group: 'CA Compliance', color: '#b45309',
    features: [
      { key: 'compliance.view',         label: 'View compliance tasks',     desc: 'Access the CA Compliance page' },
      { key: 'compliance.edit',         label: 'Edit compliance settings',  desc: 'Modify task overrides' },
      { key: 'compliance.assign',       label: 'Assign compliance tasks',   desc: 'Set assignees and approvers' },
      { key: 'compliance.manage_tasks', label: 'Manage custom tasks',       desc: 'Add or delete compliance tasks' },
    ],
  },
  {
    group: 'Monitor', color: '#7c3aed',
    features: [
      { key: 'monitor.view', label: 'View Monitor page', desc: 'Access the org-wide Monitor' },
    ],
  },
]

// Default role permissions (mirrors permissionGate.ts)
const DEFAULT_PERMISSIONS: RolePermissions = {
  'tasks.create':       { admin: true,  manager: true,  member: true,  viewer: false },
  'tasks.edit':         { admin: true,  manager: true,  member: false, viewer: false },
  'tasks.edit_own':     { admin: true,  manager: true,  member: true,  viewer: false },
  'tasks.delete':       { admin: true,  manager: true,  member: false, viewer: false },
  'tasks.complete':     { admin: true,  manager: true,  member: true,  viewer: false },
  'tasks.view_all':     { admin: true,  manager: true,  member: false, viewer: false },
  'tasks.view_my':      { admin: true,  manager: true,  member: true,  viewer: true  },
  'tasks.bulk_actions': { admin: true,  manager: true,  member: false, viewer: false },
  'tasks.assign':       { admin: true,  manager: true,  member: false, viewer: false },
  'tasks.approve':      { admin: true,  manager: true,  member: false, viewer: false },
  'projects.create':    { admin: true,  manager: true,  member: false, viewer: false },
  'projects.edit':      { admin: true,  manager: true,  member: false, viewer: false },
  'projects.delete':    { admin: true,  manager: false, member: false, viewer: false },
  'projects.view_all':  { admin: true,  manager: true,  member: true,  viewer: true  },
  'clients.create':     { admin: true,  manager: true,  member: false, viewer: false },
  'clients.edit':       { admin: true,  manager: true,  member: false, viewer: false },
  'clients.delete':     { admin: true,  manager: false, member: false, viewer: false },
  'clients.view':       { admin: true,  manager: true,  member: true,  viewer: true  },
  'recurring.create':   { admin: true,  manager: true,  member: false, viewer: false },
  'recurring.edit':     { admin: true,  manager: true,  member: false, viewer: false },
  'recurring.delete':   { admin: true,  manager: false, member: false, viewer: false },
  'reports.view_own':   { admin: true,  manager: true,  member: true,  viewer: true  },
  'reports.view_all':   { admin: true,  manager: true,  member: false, viewer: false },
  'time.log':           { admin: true,  manager: true,  member: true,  viewer: false },
  'time.view_all':      { admin: true,  manager: true,  member: false, viewer: false },
  'team.invite':        { admin: true,  manager: false, member: false, viewer: false },
  'team.remove':        { admin: true,  manager: false, member: false, viewer: false },
  'team.change_role':   { admin: true,  manager: false, member: false, viewer: false },
  'settings.org':             { admin: true,  manager: false, member: false, viewer: false },
  'settings.tasks':           { admin: true,  manager: false, member: false, viewer: false },
  'compliance.view':          { admin: true,  manager: true,  member: true,  viewer: false },
  'compliance.edit':          { admin: true,  manager: true,  member: false, viewer: false },
  'compliance.assign':        { admin: true,  manager: true,  member: false, viewer: false },
  'compliance.manage_tasks':  { admin: true,  manager: false, member: false, viewer: false },
  'monitor.view':             { admin: true,  manager: true,  member: false, viewer: false },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  memberId:        string
  memberName:      string
  memberRole:      string
  /** Current saved overrides from org_members.permissions (null = no overrides) */
  savedOverrides:  Record<string, boolean> | null
  /** Org-wide role_permissions so we can show the role default for each toggle */
  rolePermissions: RolePermissions | null
  onClose:         () => void
  onSaved:         (newOverrides: Record<string, boolean> | null) => void
}

export function UserPermissionsPanel({
  memberId, memberName, memberRole, savedOverrides, rolePermissions, onClose, onSaved,
}: Props) {
  // Local working copy: null means "use role default for this key"
  const [overrides, setOverrides] = useState<Record<string, boolean | null>>(() => {
    const init: Record<string, boolean | null> = {}
    for (const g of FEATURE_GROUPS)
      for (const f of g.features)
        init[f.key] = savedOverrides?.[f.key] ?? null
    return init
  })
  const [saving, setSaving] = useState(false)

  // Resolve what value will actually be used for a key (override → role default → hardcoded)
  function resolvedValue(key: string): boolean {
    if (overrides[key] !== null && overrides[key] !== undefined) return overrides[key] as boolean
    const rp = rolePermissions ?? DEFAULT_PERMISSIONS
    return rp[key]?.[memberRole] ?? DEFAULT_PERMISSIONS[key]?.[memberRole] ?? false
  }

  // Is this key explicitly overridden (differs from role default)?
  function isOverridden(key: string): boolean {
    return overrides[key] !== null && overrides[key] !== undefined
  }

  function toggle(key: string) {
    const current = resolvedValue(key)
    const roleDefault = (rolePermissions ?? DEFAULT_PERMISSIONS)[key]?.[memberRole]
      ?? DEFAULT_PERMISSIONS[key]?.[memberRole]
      ?? false
    const newVal = !current
    // If toggling back to the role default, clear the override
    setOverrides(prev => ({ ...prev, [key]: newVal === roleDefault ? null : newVal }))
  }

  function clearAllOverrides() {
    setOverrides(prev => Object.fromEntries(Object.keys(prev).map(k => [k, null])))
  }

  const hasAnyOverride = Object.values(overrides).some(v => v !== null)
  const overrideCount = Object.values(overrides).filter(v => v !== null).length

  async function save() {
    setSaving(true)
    try {
      // Build the flat overrides map — only keys that are actually overridden
      const payload: Record<string, boolean> = {}
      for (const [key, val] of Object.entries(overrides)) {
        if (val !== null) payload[key] = val as boolean
      }
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id:   memberId,
          permissions: Object.keys(payload).length > 0 ? payload : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Failed to save')
        return
      }
      toast.success(`Permissions updated for ${memberName}`)
      onSaved(Object.keys(payload).length > 0 ? payload : null)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    // Backdrop
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,8,20,0.55)',
        backdropFilter: 'blur(2px)', zIndex: 9000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto' }}
      onClick={onClose}>

      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 580, borderRadius: 16,
          background: 'var(--surface, #fff)', boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Permission overrides — {memberName}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Role: <strong style={{ textTransform: 'capitalize' }}>{memberRole}</strong>
              {overrideCount > 0 && (
                <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 99,
                  background: '#fef3c7', border: '1px solid #d97706',
                  fontSize: 11, fontWeight: 700, color: '#b45309' }}>
                  {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 8, border: 'none',
              background: 'var(--surface-subtle, #f8fafc)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <X size={14}/>
          </button>
        </div>

        {/* Info banner */}
        <div style={{ margin: '12px 16px 4px', padding: '8px 12px', borderRadius: 8,
          background: 'var(--surface-subtle, #f8fafc)', border: '1px solid var(--border)',
          display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 1 }}/>
          <span>
            Greyed toggles use the <strong>{memberRole}</strong> role default.
            Highlighted toggles are explicitly set for this person only — they override the role.
          </span>
        </div>

        {/* Permission groups */}
        <div style={{ overflowY: 'auto', maxHeight: '60vh', padding: '8px 0' }}>
          {FEATURE_GROUPS.map(group => (
            <div key={group.group} style={{ marginBottom: 0 }}>
              {/* Group header */}
              <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: group.color, flexShrink: 0 }}/>
                <span style={{ fontSize: 10, fontWeight: 800, color: group.color,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.group}</span>
              </div>

              {/* Feature rows */}
              {group.features.map((feature, fi) => {
                const on       = resolvedValue(feature.key)
                const overridden = isOverridden(feature.key)
                return (
                  <div key={feature.key}
                    style={{ display: 'flex', alignItems: 'center', gap: 12,
                      padding: '7px 20px',
                      borderBottom: fi < group.features.length - 1
                        ? '1px solid var(--border-light, #f1f5f9)' : 'none',
                      background: overridden
                        ? `${group.color}06`
                        : 'transparent',
                      transition: 'background 0.1s' }}>

                    {/* Toggle */}
                    <button
                      onClick={() => toggle(feature.key)}
                      title={on ? `Revoke: ${feature.label}` : `Grant: ${feature.label}`}
                      style={{
                        width: 34, height: 20, borderRadius: 10, border: 'none',
                        cursor: 'pointer', flexShrink: 0,
                        background: on
                          ? (overridden ? group.color : `${group.color}88`)
                          : (overridden ? '#e2e8f0' : 'var(--surface-subtle, #f1f5f9)'),
                        position: 'relative', transition: 'background 0.15s',
                        boxShadow: overridden ? `0 0 0 2px ${group.color}44` : 'none',
                      }}>
                      <span style={{
                        position: 'absolute', top: 2,
                        left: on ? 16 : 2,
                        width: 16, height: 16, borderRadius: 8,
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.15s',
                      }}/>
                    </button>

                    {/* Labels */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: overridden ? 600 : 500,
                          color: overridden ? 'var(--text-primary)' : 'var(--text-secondary, #475569)' }}>
                          {feature.label}
                        </span>
                        {overridden && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px',
                            borderRadius: 99, background: `${group.color}15`,
                            color: group.color, flexShrink: 0 }}>
                            overridden
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {feature.desc}
                      </p>
                    </div>

                    {/* Clear individual override */}
                    {overridden && (
                      <button
                        onClick={() => setOverrides(prev => ({ ...prev, [feature.key]: null }))}
                        title="Reset to role default"
                        style={{ width: 22, height: 22, borderRadius: 6, border: 'none',
                          background: 'transparent', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#94a3b8' }}>
                        <RotateCcw size={11}/>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={save} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px',
              borderRadius: 9, border: 'none',
              background: 'var(--brand, #0d9488)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}>
            <Save size={13}/>
            {saving ? 'Saving…' : 'Save overrides'}
          </button>
          {hasAnyOverride && (
            <button onClick={clearAllOverrides}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                borderRadius: 9, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text-secondary)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <RotateCcw size={12}/> Reset all to role default
            </button>
          )}
          <button onClick={onClose}
            style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '9px 0' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
