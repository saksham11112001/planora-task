/**
 * Permission gating — the server-side authority for "may this user do X".
 * A regression here is a security bug, not a UX bug.
 *
 * canDo() takes the Supabase client as a parameter, so it is tested against a
 * hand-rolled stub rather than a live database. The stub records every query it
 * receives so tests can also assert the gate is scoping by org and user.
 *
 * Note: the module's fetchers are wrapped in React's cache(). Outside a request
 * scope it may memoise per argument tuple, so every test uses a UNIQUE orgId to
 * guarantee isolation.
 *
 * Run: npm test
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { canDo, assertCan } from '../lib/utils/permissionGate.ts'

type Row = Record<string, unknown> | null

/** Minimal chainable stand-in for the PostgREST builder the gate uses. */
function makeSupabase(tables: { org_settings?: Row; org_members?: Row }) {
  const queries: { table: string; filters: Record<string, unknown> }[] = []
  return {
    queries,
    from(table: string) {
      const filters: Record<string, unknown> = {}
      queries.push({ table, filters })
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => { filters[col] = val; return builder },
        maybeSingle: async () => ({
          data: (tables as Record<string, Row>)[table] ?? null,
        }),
      }
      return builder
    },
  }
}

let orgSeq = 0
const nextOrg = () => `org-${++orgSeq}`

describe('canDo — owner and admin bypass', () => {
  test('owner is allowed everything, without touching the database', async () => {
    const sb = makeSupabase({})
    for (const perm of ['tasks.delete', 'team.remove', 'settings.org', 'monitor.view']) {
      assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'owner', perm), true)
    }
    assert.equal(sb.queries.length, 0, 'owner check must not hit the DB')
  })

  test('admin is allowed everything, without touching the database', async () => {
    const sb = makeSupabase({})
    for (const perm of ['tasks.delete', 'team.remove', 'settings.org']) {
      assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'admin', perm), true)
    }
    assert.equal(sb.queries.length, 0, 'admin check must not hit the DB')
  })

  test('owner/admin cannot be revoked by an org override that says false', async () => {
    // Documents the hard rule: owner/admin are not restrictable.
    const sb = makeSupabase({
      org_settings: { role_permissions: { 'tasks.delete': { admin: false, manager: false } } },
      org_members:  { permissions: { 'tasks.delete': false } },
    })
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'owner', 'tasks.delete'), true)
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'admin', 'tasks.delete'), true)
  })
})

describe('canDo — DEFAULT_PERMISSIONS fallback (no org config)', () => {
  test('manager gets manager defaults', async () => {
    const sb = makeSupabase({})
    const org = nextOrg()
    assert.equal(await canDo(sb as never, org, 'u1', 'manager', 'tasks.create'), true)
    assert.equal(await canDo(sb as never, org, 'u1', 'manager', 'team.invite'), false)
    assert.equal(await canDo(sb as never, org, 'u1', 'manager', 'projects.delete'), false)
  })

  test('member gets member defaults', async () => {
    const sb = makeSupabase({})
    const org = nextOrg()
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'tasks.create'), true)
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'tasks.edit'), false)
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'tasks.delete'), false)
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'monitor.view'), false)
  })

  test('viewer is read-only', async () => {
    const sb = makeSupabase({})
    const org = nextOrg()
    assert.equal(await canDo(sb as never, org, 'u1', 'viewer', 'tasks.view_my'), true)
    assert.equal(await canDo(sb as never, org, 'u1', 'viewer', 'clients.view'), true)
    assert.equal(await canDo(sb as never, org, 'u1', 'viewer', 'tasks.create'), false)
    assert.equal(await canDo(sb as never, org, 'u1', 'viewer', 'tasks.delete'), false)
    assert.equal(await canDo(sb as never, org, 'u1', 'viewer', 'time.log'), false)
  })
})

describe('canDo — deny by default on anything unrecognised', () => {
  test('an unknown permission key is denied, not allowed', async () => {
    // Fail-closed: a typo in a route must lock the door, not open it.
    const sb = makeSupabase({})
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'manager', 'tasks.nonexistent'), false)
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'member', 'totally.made.up'), false)
  })

  test('an unknown role is denied', async () => {
    const sb = makeSupabase({})
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'contractor', 'tasks.create'), false)
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', '', 'tasks.create'), false)
  })
})

describe('canDo — org-wide role grid overrides the defaults', () => {
  test('org grant opens a permission the default denies', async () => {
    const sb = makeSupabase({
      org_settings: { role_permissions: { 'tasks.delete': { manager: true, member: true } } },
    })
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'member', 'tasks.delete'), true)
  })

  test('org revoke closes a permission the default allows', async () => {
    const sb = makeSupabase({
      org_settings: { role_permissions: { 'tasks.create': { manager: false, member: false } } },
    })
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'member', 'tasks.create'), false)
  })

  test('keys absent from the org grid still fall back to defaults', async () => {
    const sb = makeSupabase({
      org_settings: { role_permissions: { 'tasks.delete': { member: true } } },
    })
    const org = nextOrg()
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'tasks.delete'), true)   // from grid
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'tasks.create'), true)   // from defaults
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'team.invite'), false)   // from defaults
  })
})

describe('canDo — per-user override beats the role grid', () => {
  test('user override grants what the role denies', async () => {
    const sb = makeSupabase({
      org_members:  { permissions: { 'team.invite': true } },
      org_settings: { role_permissions: { 'team.invite': { manager: false } } },
    })
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'manager', 'team.invite'), true)
  })

  test('user override revokes what the role allows', async () => {
    const sb = makeSupabase({
      org_members:  { permissions: { 'tasks.create': false } },
      org_settings: { role_permissions: { 'tasks.create': { member: true } } },
    })
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'member', 'tasks.create'), false)
  })

  test('an override object that omits the key does not shadow the role grid', async () => {
    // Presence of ANY override row must not accidentally deny everything else.
    const sb = makeSupabase({
      org_members:  { permissions: { 'team.invite': true } },
      org_settings: {},
    })
    const org = nextOrg()
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'team.invite'), true)   // overridden
    assert.equal(await canDo(sb as never, org, 'u1', 'member', 'tasks.create'), true)  // default still applies
  })

  test('only an exact `true` grants — truthy strings do not', async () => {
    const sb = makeSupabase({ org_members: { permissions: { 'tasks.delete': 'yes' } } })
    assert.equal(await canDo(sb as never, nextOrg(), 'u1', 'member', 'tasks.delete'), false)
  })
})

describe('canDo — query scoping', () => {
  test('reads are filtered by org_id, and the user override by user_id too', async () => {
    const sb = makeSupabase({ org_settings: {}, org_members: {} })
    const org = nextOrg()
    await canDo(sb as never, org, 'user-42', 'member', 'tasks.create')

    const memberQ = sb.queries.find(q => q.table === 'org_members')
    assert.ok(memberQ, 'expected an org_members lookup')
    assert.equal(memberQ.filters.org_id, org, 'user override must be scoped to the org')
    assert.equal(memberQ.filters.user_id, 'user-42', 'user override must be scoped to the user')

    const settingsQ = sb.queries.find(q => q.table === 'org_settings')
    assert.ok(settingsQ, 'expected an org_settings lookup')
    assert.equal(settingsQ.filters.org_id, org, 'role grid must be scoped to the org')
  })
})

describe('assertCan', () => {
  test('returns null when allowed', async () => {
    const sb = makeSupabase({})
    assert.equal(await assertCan(sb as never, nextOrg(), 'u1', 'owner', 'tasks.delete'), null)
  })

  test('returns a 403 payload when denied', async () => {
    const sb = makeSupabase({})
    const denied = await assertCan(sb as never, nextOrg(), 'u1', 'viewer', 'tasks.delete')
    assert.ok(denied, 'expected a denial payload')
    assert.equal(denied.status, 403)
    assert.equal(typeof denied.error, 'string')
    assert.ok(denied.error.length > 0)
  })
})
