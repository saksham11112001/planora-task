/**
 * Server-side permission gating utility.
 * Reads role_permissions from org_settings and checks if a given role
 * is allowed to perform an action. Falls back to DEFAULT_PERMISSIONS
 * if the org has never saved custom permissions.
 *
 * Owner is always allowed everything (bypasses all gates).
 * Admin is always allowed everything per product decision.
 */
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
export type RolePermissions = Record<string, Record<string, boolean>>

// Mirrors DEFAULT_PERMISSIONS in PermissionsView.tsx
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
  'settings.org':              { admin: true,  manager: false, member: false, viewer: false },
  'settings.tasks':            { admin: true,  manager: false, member: false, viewer: false },
  'compliance.view':           { admin: true,  manager: true,  member: true,  viewer: false },
  'compliance.edit':           { admin: true,  manager: true,  member: false, viewer: false },
  'compliance.assign':         { admin: true,  manager: true,  member: false, viewer: false },
  'compliance.manage_tasks':   { admin: true,  manager: false, member: false, viewer: false },
  'monitor.view':              { admin: true,  manager: true,  member: false, viewer: false },
}

/**
 * Cached per-request fetch of role_permissions for an org.
 * React cache() deduplicates identical calls within one server request.
 */
const fetchOrgPermissions = cache(async (
  supabase: SupabaseClient,
  orgId: string,
): Promise<RolePermissions> => {
  const { data } = await supabase
    .from('org_settings')
    .select('role_permissions')
    .eq('org_id', orgId)
    .maybeSingle()
  return (data?.role_permissions as RolePermissions | null) ?? DEFAULT_PERMISSIONS
})

/**
 * Returns true if `role` is allowed to do `permission` in `orgId`.
 *
 * - 'owner' bypasses everything
 * - 'admin' bypasses everything (product decision — cannot be toggled)
 * - Falls back to DEFAULT_PERMISSIONS when org has no saved permissions
 */
export async function canDo(
  supabase: SupabaseClient,
  orgId: string,
  role: string,
  permission: string,
): Promise<boolean> {
  if (role === 'owner' || role === 'admin') return true
  const perms = await fetchOrgPermissions(supabase, orgId)
  const row = perms[permission] ?? DEFAULT_PERMISSIONS[permission]
  if (!row) return false
  return row[role] === true
}

/** Convenience: returns a 403 NextResponse if the check fails, otherwise null. */
export async function assertCan(
  supabase: SupabaseClient,
  orgId: string,
  role: string,
  permission: string,
): Promise<{ error: string; status: 403 } | null> {
  const allowed = await canDo(supabase, orgId, role, permission)
  if (!allowed) return { error: 'You do not have permission to perform this action', status: 403 }
  return null
}
