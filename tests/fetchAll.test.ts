/**
 * Paging helper for reads that must be complete.
 *
 * PostgREST truncates at max-rows silently, which is how CA compliance tasks
 * went missing for every client past the cut-off. These tests pin the two
 * things that matter: nothing is dropped, and nothing extra is fetched.
 *
 * Run: npm test
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllRows, chunk, PAGE_SIZE } from '../lib/supabase/fetchAll.ts'

/** Stands in for a PostgREST table that caps every response at `cap` rows. */
function fakeTable(total: number, cap = PAGE_SIZE) {
  const calls: Array<[number, number]> = []
  const build = async (from: number, to: number) => {
    calls.push([from, to])
    const width = Math.min(to - from + 1, cap)
    const rows: number[] = []
    for (let i = from; i < Math.min(from + width, total); i++) rows.push(i)
    return { data: rows, error: null }
  }
  return { build, calls }
}

describe('fetchAllRows', () => {
  test('returns every row when the table is larger than one page', async () => {
    const t = fakeTable(2500)
    const { data, error } = await fetchAllRows<number>(t.build)
    assert.equal(error, null)
    assert.equal(data.length, 2500)
    assert.equal(data[0], 0)
    assert.equal(data[2499], 2499)
  })

  test('stops as soon as a page comes back short', async () => {
    const t = fakeTable(1200)
    const { data } = await fetchAllRows<number>(t.build)
    assert.equal(data.length, 1200)
    assert.equal(t.calls.length, 2, 'should not request a page past the end')
  })

  test('a single short page costs exactly one request', async () => {
    const t = fakeTable(10)
    const { data } = await fetchAllRows<number>(t.build)
    assert.equal(data.length, 10)
    assert.equal(t.calls.length, 1)
  })

  test('never fetches more than the caller asked for', async () => {
    // A caller wanting 50 rows must not receive a whole 1000-row page.
    const t = fakeTable(5000)
    const { data } = await fetchAllRows<number>(t.build, { maxRows: 50 })
    assert.equal(data.length, 50)
    assert.deepEqual(t.calls, [[0, 49]])
  })

  test('honours a row budget that is not a multiple of the page size', async () => {
    const t = fakeTable(5000)
    const { data } = await fetchAllRows<number>(t.build, { maxRows: 2500 })
    assert.equal(data.length, 2500)
    assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2499]])
  })

  test('an empty table returns an empty array, not null', async () => {
    const t = fakeTable(0)
    const { data, error } = await fetchAllRows<number>(t.build)
    assert.deepEqual(data, [])
    assert.equal(error, null)
  })

  test('surfaces the error and stops rather than looping', async () => {
    let calls = 0
    const { data, error } = await fetchAllRows<number>(async (from, to) => {
      calls++
      if (from === 0) return { data: Array.from({ length: to - from + 1 }, (_, i) => i), error: null }
      return { data: null, error: { message: 'boom' } }
    })
    assert.equal(calls, 2)
    assert.equal(data.length, PAGE_SIZE, 'partial data comes back with the error')
    assert.equal((error as { message: string }).message, 'boom')
  })
})

describe('chunk', () => {
  test('leaves a list that already fits as one chunk', () => {
    assert.deepEqual(chunk([1, 2, 3], 200), [[1, 2, 3]])
  })

  test('splits a long list and loses nothing', () => {
    const ids = Array.from({ length: 450 }, (_, i) => i)
    const parts = chunk(ids, 200)
    assert.deepEqual(parts.map(p => p.length), [200, 200, 50])
    assert.deepEqual(parts.flat(), ids)
  })

  test('an empty list produces no chunks, so callers run no queries', () => {
    assert.deepEqual(chunk([]), [])
  })
})
