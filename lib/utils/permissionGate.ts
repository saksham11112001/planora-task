/**
 * Server-side permission gating utility.
 *
 * Resolution order for every permission check:
 *   1. owner / admin  → always allowed (cannot be restricted)
 *   2. org_members.permissions[key]  → explicit per-user override, if set
 *   3. org_settings.role_permissions[key][role]  → org-wide role default
 *   4. DEFAULT_PERMISSIONS[key][role]  → hardcoded fallback
 */
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
export type RolePermissions = Record<string, Record<string, boolean>>

// Mirrors DEFAULT_PERMISSIONS in PermissionsView.tsx and useOrgSettings.ts
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
 * Cached per-request fetch of org-wide role_permissions.
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
 * Cached per-request fetch of a user's personal permission overrides
 * from org_members.permissions. Returns null if no overrides are set.
 */
const fetchUserPermissionOverrides = cache(async (
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<Record<string, boolean> | null> => {
  const { data } = await supabase
    .from('org_members')
    .select('permissions')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.permissions as Record<string, boolean> | null) ?? null
})

/**
 * Returns true if `userId` with `role` is allowed to do `permission` in `orgId`.
 *
 * Resolution order:
 *   1. owner / admin              → always true
 *   2. org_members.permissions    → per-user override if the key is set
 *   3. org_settings.role_permissions → org-wide role grid
 *   4. DEFAULT_PERMISSIONS        → hardcoded fallback
 */
export async function canDo(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  role: string,
  permission: string,
): Promise<boolean> {
  if (role === 'owner' || role === 'admin') return true

  // Per-user override takes priority over role default
  const overrides = await fetchUserPermissionOverrides(supabase, orgId, userId)
  if (overrides !== null && permission in overrides) {
    return overrides[permission] === true
  }

  // Role-based fallback
  const perms = await fetchOrgPermissions(supabase, orgId)
  const row = perms[permission] ?? DEFAULT_PERMISSIONS[permission]
  if (!row) {
    if (!(permission in DEFAULT_PERMISSIONS)) {
      console.warn(`[permissionGate] Unknown permission key: "${permission}" — defaulting to deny`)
    }
    return false
  }
  return row[role] === true
}

/** Convenience: returns a 403 NextResponse payload if the check fails, otherwise null. */
export async function assertCan(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  role: string,
  permission: string,
): Promise<{ error: string; status: 403 } | null> {
  const allowed = await canDo(supabase, orgId, userId, role, permission)
  if (!allowed) return { error: 'You do not have permission to perform this action', status: 403 }
  return null
}
