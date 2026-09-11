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

describe('fetchAllRows — the ceiling that took production down', () => {
  // The default used to be 200_000, i.e. up to 200 sequential round trips for
  // any caller that forgot to pass one — and every caller did forget. On
  // /api/ca/assignments, where each page is a four-way join and three views hit
  // it on load, the fan-out saturated the API tier until every request queued
  // past Vercel's 60s limit. /api/health timed out and the site was down.
  test('an unbounded caller cannot issue more than five round trips', async () => {
    let calls = 0
    // A table that always has another full page — the worst case.
    const { data, truncated } = await fetchAllRows<number>((from, to) => {
      calls++
      return Promise.resolve({ data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null })
    })
    assert.equal(calls, 5, 'default ceiling is five pages, not two hundred')
    assert.equal(data.length, 5 * PAGE_SIZE)
    assert.equal(truncated, true, 'stopping at our own ceiling must be reported')
  })

  test('a caller that asks for more gets it, but only by saying so', async () => {
    let calls = 0
    const { truncated } = await fetchAllRows<number>((from, to) => {
      calls++
      return Promise.resolve({ data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null })
    }, { maxRows: 2 * PAGE_SIZE })
    assert.equal(calls, 2)
    assert.equal(truncated, true)
  })

  test('a complete read is never flagged as truncated', async () => {
    const { data, truncated } = await fetchAllRows<number>((from, to) =>
      Promise.resolve({ data: from === 0 ? Array.from({ length: 10 }, (_, i) => i) : [], error: null }))
    assert.equal(data.length, 10)
    assert.equal(truncated, false, 'a short page means the data ran out, not the budget')
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
