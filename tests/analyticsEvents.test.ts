/**
 * Event names are an interface with PostHog's stored history.
 *
 * Renaming one does not rename the data already captured under the old name:
 * the old series stops and a new one starts, and any funnel built on it
 * quietly splits in two with no error anywhere. These tests pin the exact
 * strings so that a rename is a deliberate act with a failing test attached,
 * rather than a tidy-up someone does on the way past.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS, safeProps } from '../lib/analytics/events.ts'

describe('event names', () => {
  test('org_created keeps its name — it is already live with real history', () => {
    // Captured in app/onboarding since before this module existed. Renaming it
    // would orphan every signup recorded to date.
    assert.equal(EVENTS.ORG_CREATED, 'org_created')
  })

  test('auth_started is not called signup_started', () => {
    // The Google and Microsoft buttons serve sign-in and sign-up alike, so an
    // event named for signup would count every returning user as a new one.
    assert.equal(EVENTS.AUTH_STARTED, 'auth_started')
    assert.equal((EVENTS as Record<string, string>).SIGNUP_STARTED, undefined)
  })

  test('the full catalogue is exactly these strings', () => {
    assert.deepEqual({ ...EVENTS }, {
      AUTH_STARTED:          'auth_started',
      ORG_CREATED:           'org_created',
      CLIENT_CREATED:        'client_created',
      TASK_CREATED:          'task_created',
      MEMBER_INVITED:        'member_invited',
      COMPLIANCE_GENERATED:  'compliance_tasks_generated',
      MSME_VENDORS_IMPORTED: 'msme_vendors_imported',
      MSME_EMAILS_SENT:      'msme_emails_sent',
      UPGRADE_VIEWED:        'upgrade_viewed',
      CHECKOUT_STARTED:      'checkout_started',
    })
  })

  test('names are snake_case and free of spaces', () => {
    // PostHog accepts anything, which is the problem: "Task Created" and
    // "task_created" are two different series and both look right in a list.
    for (const name of Object.values(EVENTS)) {
      assert.match(name, /^[a-z][a-z0-9_]*$/, `${name} is not snake_case`)
    }
  })

  test('no two events share a name', () => {
    const names = Object.values(EVENTS)
    assert.equal(new Set(names).size, names.length)
  })
})

describe('safeProps', () => {
  test('counts, plans and booleans pass through', () => {
    assert.deepEqual(
      safeProps({ total_clients: 12, is_first: false, plan: 'pro', source: 'csv' }),
      { total_clients: 12, is_first: false, plan: 'pro', source: 'csv' },
    )
  })

  test('a client or vendor name never reaches the analytics vendor', () => {
    const out = safeProps({ vendor_name: 'Ambika Agro Products LLP', count: 3 })
    assert.deepEqual(out, { count: 3 })
  })

  test('emails are dropped by key AND by value', () => {
    // By key for the obvious case, by value for the one where someone put an
    // address in a field called something else.
    assert.deepEqual(safeProps({ vendor_email: 'a@b.com' }), {})
    assert.deepEqual(safeProps({ contact: 'a@b.com' }), {})
  })

  test('tax identifiers and tokens are dropped', () => {
    assert.deepEqual(
      safeProps({ gstin: '27AA', pan: 'ABCDE1234F', token: 'xyz', udyam_number: 'U1', n: 1 }),
      { n: 1 },
    )
  })

  test('the allowed keys survive even though they look like names', () => {
    // 'plan' and 'method' are closed enums, not free text.
    assert.deepEqual(
      safeProps({ plan: 'business', method: 'google', from_plan: 'free', to_plan: 'pro' }),
      { plan: 'business', method: 'google', from_plan: 'free', to_plan: 'pro' },
    )
  })

  test("org_name survives — it is the account holder's own business", () => {
    // identify() in AppShell already sends org_name. Stripping it here while
    // sending it there would be an inconsistency pretending to be a safeguard.
    assert.deepEqual(
      safeProps({ org_name: 'SGNG & Associates', team_size: 26 }),
      { org_name: 'SGNG & Associates', team_size: 26 },
    )
  })

  test("but the firm's CLIENTS and their VENDORS never leave", () => {
    // These people are not the customer and never agreed to anything.
    assert.deepEqual(safeProps({ client_name: 'Kids Hut', n: 1 }), { n: 1 })
    assert.deepEqual(safeProps({ vendor_name: 'Discovery Alcobev', n: 1 }), { n: 1 })
    assert.deepEqual(safeProps({ declarant_name: 'A Person', n: 1 }), { n: 1 })
    assert.deepEqual(safeProps({ assignee_name: 'Ravi Murarka', n: 1 }), { n: 1 })
  })

  test('an empty object stays empty and does not throw', () => {
    assert.deepEqual(safeProps({}), {})
  })
})
