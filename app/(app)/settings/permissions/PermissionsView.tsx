'use client'
import { useState } from 'react'
import { Check, X, Lock, Zap, Shield, Users, Eye, Info, Save, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/store/appStore'

// ─── Data model ──────────────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'member' | 'viewer'

export interface FeaturePermission {
  allowed: boolean
}

export type RolePermissions = Record<string, Record<Role, boolean>>

// Feature categories and their permissions
const FEATURE_GROUPS = [
  {
    group: 'Tasks',
    color: '#0d9488',
    features: [
      { key: 'tasks.create',        label: 'Create tasks',            desc: 'Add new one-time tasks' },
      { key: 'tasks.edit',          label: 'Edit any task',           desc: 'Edit tasks assigned to others' },
      { key: 'tasks.edit_own',      label: 'Edit own tasks',          desc: 'Edit tasks assigned to themselves' },
      { key: 'tasks.delete',        label: 'Delete tasks',            desc: 'Move tasks to trash' },
      { key: 'tasks.complete',      label: 'Complete tasks',          desc: 'Mark tasks as done' },
      { key: 'tasks.bulk_actions',  label: 'Bulk complete/delete',    desc: 'Act on multiple tasks at once' },
      { key: 'tasks.assign',        label: 'Assign tasks to others',  desc: 'Set assignee to another member' },
      { key: 'tasks.approve',       label: 'Approve tasks',           desc: 'Approve tasks in review state' },
    ],
  },
  {
    group: 'Projects',
    color: '#7c3aed',
    features: [
      { key: 'projects.create',     label: 'Create projects',         desc: 'Start new projects' },
      { key: 'projects.edit',       label: 'Edit projects',           desc: 'Rename, recolour, change settings' },
      { key: 'projects.delete',     label: 'Delete projects',         desc: 'Archive or delete a project' },
      { key: 'projects.view_all',   label: 'View all projects',       desc: 'See projects they are not a member of' },
    ],
  },
  {
    group: 'Clients',
    color: '#0891b2',
    features: [
      { key: 'clients.create',      label: 'Create clients',          desc: 'Add new client records' },
      { key: 'clients.edit',        label: 'Edit clients',            desc: 'Update client details' },
      { key: 'clients.delete',      label: 'Delete clients',          desc: 'Remove client records' },
      { key: 'clients.view',        label: 'View clients',            desc: 'See client list and details' },
    ],
  },
  {
    group: 'Recurring tasks',
    color: '#ea580c',
    features: [
      { key: 'recurring.create',    label: 'Create recurring tasks',  desc: 'Set up repeating task schedules' },
      { key: 'recurring.edit',      label: 'Edit recurring tasks',    desc: 'Change frequency, assignee etc.' },
      { key: 'recurring.delete',    label: 'Delete recurring tasks',  desc: 'Remove a recurring task' },
    ],
  },
  {
    group: 'Reports & time',
    color: '#ca8a04',
    features: [
      { key: 'reports.view_own',    label: 'View own reports',        desc: 'See their own performance stats' },
      { key: 'reports.view_all',    label: 'View all reports',        desc: 'See reports for the whole team' },
      { key: 'time.log',            label: 'Log time',                desc: 'Add time entries to tasks' },
      { key: 'time.view_all',       label: 'View all time logs',      desc: 'See time logs for all members' },
    ],
  },
  {
    group: 'Team & settings',
    color: '#db2777',
    features: [
      { key: 'team.invite',         label: 'Invite members',          desc: 'Send invite emails to new users' },
      { key: 'team.remove',         label: 'Remove members',          desc: 'Deactivate team member access' },
      { key: 'team.change_role',    label: 'Change member roles',     desc: 'Promote or demote team members' },
      { key: 'settings.org',        label: 'Edit organisation settings', desc: 'Change org name, logo, colour' },
      { key: 'settings.tasks',      label: 'Edit task field settings', desc: 'Show/hide and set mandatory fields' },
    ],
  },
]

const ROLES: { key: Role; label: string; color: string; icon: any }[] = [
  { key: 'admin',   label: 'Admin',   color: '#7c3aed', icon: Shield },
  { key: 'manager', label: 'Manager', color: '#0d9488', icon: Users  },
  { key: 'member',  label: 'Member',  color: '#0891b2', icon: Users  },
  { key: 'viewer',  label: 'Viewer',  color: '#94a3b8', icon: Eye    },
]

// Default permissions — sensible baseline for each role
const DEFAULT_PERMISSIONS: RolePermissions = {
  'tasks.create':       { admin: true,  manager: true,  member: true,  viewer: false },
  'tasks.edit':         { admin: true,  manager: true,  member: false, viewer: false },
  'tasks.edit_own':     { admin: true,  manager: true,  member: true,  viewer: false },
  'tasks.delete':       { admin: true,  manager: true,  member: false, viewer: false },
  'tasks.complete':     { admin: true,  manager: true,  member: true,  viewer: false },
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
  'settings.org':       { admin: true,  manager: false, member: false, viewer: false },
  'settings.tasks':     { admin: true,  manager: false, member: false, viewer: false },
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  orgId: string
  savedPermissions: RolePermissions | null
  isPaid: boolean
  planTier: string
}

export function PermissionsView({ orgId, savedPermissions, isPaid, planTier }: Props) {
  const [perms,   setPerms]   = useState<RolePermissions>(savedPermissions ?? DEFAULT_PERMISSIONS)
  const [saving,  setSaving]  = useState(false)
  const [changed, setChanged] = useState(false)

  function toggle(featureKey: string, role: Role) {
    if (!isPaid) return
    // Admin always has full access — cannot be toggled
    if (role === 'admin') {
      toast.info('Admin always has full access. Use the Owner role to restrict admins.')
      return
    }
    setPerms(prev => ({
      ...prev,
      [featureKey]: {
        ...(prev[featureKey] ?? DEFAULT_PERMISSIONS[featureKey]),
        [role]: !(prev[featureKey]?.[role] ?? DEFAULT_PERMISSIONS[featureKey]?.[role] ?? false),
      },
    }))
    setChanged(true)
  }

  function resetToDefaults() {
    setPerms(DEFAULT_PERMISSIONS)
    setChanged(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, role_permissions: perms }),
      })
      if (res.ok) {
        toast.success('Permissions saved ✓')
        setChanged(false)
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Failed to save')
      }
    } finally { setSaving(false) }
  }

  const isOn = (featureKey: string, role: Role): boolean => {
    if (role === 'admin') return true // admin always full access
    return perms[featureKey]?.[role] ?? DEFAULT_PERMISSIONS[featureKey]?.[role] ?? false
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Shield style={{ width: 20, height: 20, color: '#7c3aed' }}/>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Role permissions
          </h1>
          {!isPaid && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px',
              borderRadius: 99, background: '#fef2f2', border: '1px solid #fecaca',
              fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
              <Lock style={{ width: 9, height: 9 }}/> Paid feature
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Control exactly what each role can do in your organisation.
          Owners always have full access and cannot be restricted.
        </p>
      </div>

      {/* Paid upsell */}
      {!isPaid && (
        <div style={{ marginBottom: 24, padding: '18px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, #faf5ff, #f0fdfa)',
          border: '1px solid #ddd6fe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ width: 16, height: 16, color: '#fff' }}/>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#4c1d95', margin: 0 }}>
                Role permissions is a paid feature
              </p>
              <p style={{ fontSize: 12, color: '#6d28d9', margin: 0 }}>
                Available on Starter, Pro, and Business plans
              </p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#5b21b6', marginBottom: 14, lineHeight: 1.6 }}>
            You can preview the permission matrix below, but saving changes requires an active paid plan.
            The grid shows your current default permissions.
          </p>
          <Link href="/settings/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, background: '#7c3aed', color: '#fff',
            textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            <Zap style={{ width: 13, height: 13 }}/> Upgrade to customise permissions
          </Link>
        </div>
      )}

      {/* Role headers legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {ROLES.map(r => {
          const Icon = r.icon
          return (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              background: `${r.color}12`, border: `1px solid ${r.color}30` }}>
              <Icon style={{ width: 12, height: 12, color: r.color }}/>
              <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.label}</span>
              {r.key === 'admin' && (
                <span style={{ fontSize: 10, color: r.color, opacity: 0.7 }}>(always full access)</span>
              )}
            </div>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: 'var(--text-muted)' }}>
          <Info style={{ width: 12, height: 12 }}/>
          Click a cell to toggle permission
        </div>
      </div>

      {/* Permission grid */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
        marginBottom: 20, opacity: isPaid ? 1 : 0.85 }}>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 76px)',
          background: 'var(--surface-subtle)', borderBottom: '2px solid var(--border)',
          padding: '0 16px' }}>
          <div style={{ padding: '12px 0', fontSize: 11, fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Feature
          </div>
          {ROLES.map(r => {
            const Icon = r.icon
            return (
              <div key={r.key} style={{ padding: '12px 0', textAlign: 'center' }}>
                <Icon style={{ width: 14, height: 14, color: r.color, margin: '0 auto 3px' }}/>
                <div style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.label}</div>
              </div>
            )
          })}
        </div>

        {/* Feature groups */}
        {FEATURE_GROUPS.map((group, gi) => (
          <div key={group.group}>
            {/* Group header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 76px)',
              background: `${group.color}08`, padding: '7px 16px',
              borderTop: gi > 0 ? '2px solid var(--border)' : undefined,
              borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: group.color,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: group.color }}/>
                {group.group}
              </div>
              {/* "Select all" toggles per column for this group */}
              {ROLES.map(r => {
                const allOn  = group.features.every(f => isOn(f.key, r.key))
                const someOn = group.features.some(f => isOn(f.key, r.key))
                const canToggle = isPaid && r.key !== 'admin'
                return (
                  <div key={r.key} style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        if (!canToggle) return
                        const newVal = !allOn
                        setPerms(prev => {
                          const next = { ...prev }
                          group.features.forEach(f => {
                            next[f.key] = { ...(next[f.key] ?? DEFAULT_PERMISSIONS[f.key]), [r.key]: newVal }
                          })
                          return next
                        })
                        setChanged(true)
                      }}
                      title={canToggle ? (allOn ? 'Remove all in group' : 'Allow all in group') : undefined}
                      style={{ width: 22, height: 22, borderRadius: 5, border: 'none', cursor: canToggle ? 'pointer' : 'default',
                        background: r.key === 'admin' ? `${r.color}30`
                          : allOn ? `${r.color}20` : someOn ? `${r.color}10` : 'var(--surface-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                        transition: 'all 0.12s' }}>
                      {r.key === 'admin'
                        ? <Check style={{ width: 11, height: 11, color: r.color }}/>
                        : allOn
                        ? <Check style={{ width: 11, height: 11, color: r.color }}/>
                        : someOn
                        ? <div style={{ width: 8, height: 2, borderRadius: 1, background: r.color }}/>
                        : <X style={{ width: 10, height: 10, color: 'var(--text-muted)' }}/>
                      }
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Individual feature rows */}
            {group.features.map((feature, fi) => (
              <div key={feature.key}
                style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 76px)',
                  alignItems: 'center', padding: '0 16px',
                  borderBottom: fi < group.features.length - 1 ? '1px solid var(--border-light)' : 'none',
                  background: 'var(--surface)',
                  transition: 'background 0.1s' }}>

                {/* Feature label */}
                <div style={{ padding: '11px 0' }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {feature.label}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{feature.desc}</p>
                </div>

                {/* Role cells */}
                {ROLES.map(r => {
                  const on       = isOn(feature.key, r.key)
                  const isAdmin  = r.key === 'admin'
                  const canClick = isPaid && !isAdmin

                  return (
                    <div key={r.key} style={{ textAlign: 'center', padding: '8px 0' }}>
                      <button
                        onClick={() => toggle(feature.key, r.key)}
                        disabled={!canClick}
                        style={{
                          width: 32, height: 32, borderRadius: 8, border: 'none',
                          cursor: canClick ? 'pointer' : 'default',
                          background: on
                            ? `${r.color}18`
                            : 'var(--surface-subtle)',
                          border: `1.5px solid ${on ? r.color + '44' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto', transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => {
                          if (!canClick) return
                          const el = e.currentTarget as HTMLElement
                          el.style.transform = 'scale(1.15)'
                          el.style.boxShadow = `0 2px 8px ${r.color}30`
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLElement
                          el.style.transform = 'scale(1)'
                          el.style.boxShadow = 'none'
                        }}
                        title={canClick ? (on ? `Remove ${r.label} access` : `Grant ${r.label} access`) : undefined}
                      >
                        {isAdmin
                          ? <Check style={{ width: 14, height: 14, color: r.color }}/>
                          : on
                          ? <Check style={{ width: 14, height: 14, color: r.color }}/>
                          : <X style={{ width: 13, height: 13, color: 'var(--text-muted)' }}/>
                        }
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Action bar */}
      {isPaid && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={save} disabled={saving || !changed}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px',
              borderRadius: 9, border: 'none',
              background: changed ? 'var(--brand)' : 'var(--border)',
              color: changed ? '#fff' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 600, cursor: changed ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 0.15s', opacity: saving ? 0.7 : 1 }}>
            <Save style={{ width: 14, height: 14 }}/>
            {saving ? 'Saving…' : 'Save permissions'}
          </button>
          <button onClick={resetToDefaults}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              borderRadius: 9, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RotateCcw style={{ width: 13, height: 13 }}/> Reset to defaults
          </button>
          {changed && (
            <span style={{ fontSize: 12, color: 'var(--brand)', fontStyle: 'italic' }}>
              Unsaved changes
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8,
        background: 'var(--surface-subtle)', border: '1px solid var(--border)',
        display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }}/>
        <span>
          These permissions control what team members can <em>do</em> in the UI.
          <strong style={{ color: 'var(--text-secondary)' }}> Owner</strong> always has full access and cannot be restricted.
          <strong style={{ color: 'var(--text-secondary)' }}> Admin</strong> access is locked to full — demote to Manager to restrict.
          Changes take effect immediately after saving.
        </span>
      </div>
    </div>
  )
}
