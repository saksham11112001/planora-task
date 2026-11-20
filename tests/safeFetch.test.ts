/**
 * The MSME vendor form's writes must never leave a spinner running.
 *
 * The production error that prompted this was `TypeError: Failed to fetch` on
 * the vendor declaration form. The throw skipped the spinner reset and the
 * error message alike, so the vendor saw "Saving…" forever and assumed it had
 * worked. Every case below is one that used to throw.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { safeFetchJson } from '../lib/http/safeFetch.ts'

/** A fetch that behaves however the test needs. */
function fakeFetch(behaviour: {
  throws?: unknown
  status?: number
  body?: string
  bodyThrows?: boolean
}): typeof fetch {
  return (async () => {
    if (behaviour.throws) throw behaviour.throws
    return {
      ok:     (behaviour.status ?? 200) >= 200 && (behaviour.status ?? 200) < 300,
      status: behaviour.status ?? 200,
      text:   async () => {
        if (behaviour.bodyThrows) throw new TypeError('network error while reading body')
        return behaviour.body ?? ''
      },
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe('the failure that was reported', () => {
  test('a thrown "Failed to fetch" is returned, not thrown', () => {
    // This is the exact production error. If this ever throws again, the
    // spinner-never-stops bug is back.
    return safeFetchJson('/api/x', {}, fakeFetch({ throws: new TypeError('Failed to fetch') }))
      .then(r => {
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.kind, 'network')
      })
  })

  test('the vendor is told their data is safe', async () => {
    // Without this sentence people retype the whole form or abandon it.
    const r = await safeFetchJson('/api/x', {}, fakeFetch({ throws: new TypeError('Failed to fetch') }))
    assert.ok(!r.ok && /nothing you have entered has been lost/i.test(r.error))
  })

  test('the raw browser message is never shown to the vendor', async () => {
    const r = await safeFetchJson('/api/x', {}, fakeFetch({ throws: new TypeError('Failed to fetch') }))
    assert.ok(!r.ok && !/failed to fetch/i.test(r.error), 'must not leak the TypeError text')
  })

  test('a non-Error throw does not escape either', async () => {
    const r = await safeFetchJson('/api/x', {}, fakeFetch({ throws: 'something odd' }))
    assert.equal(r.ok, false)
  })
})

describe('responses that are not JSON', () => {
  test('a 502 HTML page does not throw', async () => {
    // res.json() on this is what threw before. A big upload timing out at the
    // edge returns exactly this.
    const r = await safeFetchJson('/api/x', {}, fakeFetch({
      status: 502, body: '<!DOCTYPE html><html><body>Bad gateway</body></html>',
    }))
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.kind, 'bad_response')
    assert.equal(!r.ok && r.status, 502)
  })

  test('a 413 on a large upload is reported, not crashed on', async () => {
    const r = await safeFetchJson('/api/x', {}, fakeFetch({ status: 413, body: 'Request Entity Too Large' }))
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.status, 413)
  })

  test('an empty body with a success status is fine', async () => {
    const r = await safeFetchJson('/api/x', {}, fakeFetch({ status: 204, body: '' }))
    assert.equal(r.ok, true)
  })

  test('a body that dies mid-read is a network failure', async () => {
    const r = await safeFetchJson('/api/x', {}, fakeFetch({ status: 200, bodyThrows: true }))
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.kind, 'network')
  })
})

describe('the server answering properly', () => {
  test('a success body comes back as data', async () => {
    const r = await safeFetchJson<{ url: string }>('/api/x', {}, fakeFetch({
      status: 200, body: JSON.stringify({ url: 'https://files/x.pdf' }),
    }))
    assert.equal(r.ok, true)
    assert.equal(r.ok && r.data.url, 'https://files/x.pdf')
  })

  test("the server's own error message is preferred over a generic one", async () => {
    // The API routes write these for this audience; replacing them with
    // something generic would lose the only useful part.
    const r = await safeFetchJson('/api/x', {}, fakeFetch({
      status: 422, body: JSON.stringify({ error: 'This declaration has already been submitted.' }),
    }))
    assert.equal(!r.ok && r.error, 'This declaration has already been submitted.')
    assert.equal(!r.ok && r.kind, 'server')
  })

  test('a 200 that carries an error is still a failure', async () => {
    // Some routes in this codebase answer 200 with { error }. Treating that
    // as success would show the vendor a confirmation for a declaration that
    // was never recorded.
    const r = await safeFetchJson('/api/x', {}, fakeFetch({
      status: 200, body: JSON.stringify({ error: 'Token expired' }),
    }))
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.error, 'Token expired')
  })

  test('an error status with no usable message still explains itself', async () => {
    const r = await safeFetchJson('/api/x', {}, fakeFetch({ status: 500, body: JSON.stringify({ oops: 1 }) }))
    assert.equal(r.ok, false)
    assert.ok(!r.ok && r.error.length > 0)
  })
})
