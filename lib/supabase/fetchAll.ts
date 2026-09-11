/**
 * Paging helpers for reads that must return EVERY matching row.
 *
 * PostgREST caps every response at the project's `max-rows` setting — 1000 on
 * Supabase's defaults — and says nothing when it truncates. A query for 5000
 * rows returns 1000 with no error and no flag, so the caller quietly works from
 * a third of the data. Asking for a bigger `.range()` or `.limit()` does not
 * help; the cap is applied after them.
 *
 * That is how CA compliance tasks went missing: the org had more compliance
 * tasks than the cap, the list was ordered by due date, and everything past the
 * cut-off simply never reached the browser. The same truncation hit the daily
 * spawn job, so most clients' tasks were never created in the first place.
 *
 * Use `fetchAllRows` for any read whose completeness the product depends on.
 */

/** Supabase's default `max-rows`. Requesting more than this in one round trip is pointless. */
export const PAGE_SIZE = 1000

/**
 * Default ceiling — five pages.
 *
 * This was 200_000, i.e. up to TWO HUNDRED sequential round trips for a single
 * caller that did not pass its own cap, and none of the original call sites
 * did. Each page of /api/ca/assignments is a four-way joined read, and that
 * endpoint is hit by three CA views on load. The fan-out saturated the Supabase
 * API tier until every request queued past Vercel's 60-second limit — including
 * /api/health, which does nothing but a HEAD count. The site was down until the
 * deploy was rolled back.
 *
 * A default has to be safe when someone forgets it, so it is now sized for a
 * request path. Background jobs that genuinely need more pass maxRows
 * explicitly and say why.
 */
const MAX_ROWS = 5_000

type PageResult<T> = { data: T[] | null; error: unknown }

/**
 * Page through a query until it stops returning full pages.
 *
 * `build(from, to)` must return the query with `.range(from, to)` applied and a
 * DETERMINISTIC order — without one, Postgres may hand back the same row twice
 * across pages and drop another. Order by a unique column (`id` works) unless
 * the query already orders by something unique.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  opts: { pageSize?: number; maxRows?: number } = {},
): Promise<{ data: T[]; error: unknown; truncated: boolean }> {
  const pageSize = Math.max(1, opts.pageSize ?? PAGE_SIZE)
  const maxRows  = opts.maxRows ?? MAX_ROWS
  const out: T[] = []
  // True when the ceiling stopped us rather than the data running out. Silent
  // truncation is the fault this helper exists to fix, so hitting our OWN limit
  // has to be reported the same way — otherwise we have simply moved the lie
  // from 1000 rows to maxRows.
  let truncated = false

  for (let from = 0; from < maxRows; from += pageSize) {
    // Never ask for more than the caller's remaining budget — a caller that
    // wants 50 rows must get 50, not a whole page.
    const size = Math.min(pageSize, maxRows - from)
    const { data, error } = await build(from, from + size - 1)
    // Return what we have alongside the error — callers decide whether a partial
    // read is usable. None of them should treat it as complete.
    if (error) return { data: out, error, truncated }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < size) return { data: out, error: null, truncated: false }
    // A full last page means there was very likely more to come.
    if (from + size >= maxRows) truncated = true
  }

  if (truncated) {
    console.warn(`[fetchAllRows] stopped at the ${maxRows}-row ceiling — result is incomplete`)
  }
  return { data: out, error: null, truncated }
}

/**
 * Split a list of ids for `.in()` filters.
 *
 * A GET with a few thousand UUIDs in the query string exceeds the URL length
 * limits of the proxies in front of Postgres and comes back 414 — which reads
 * as "no rows" to code that only checks `data`. The daily CA spawn hit exactly
 * this: its dedup lookup failed, so it re-attempted work it had already done
 * and burned its step budget before reaching the clients further down the list.
 */
// 100 UUIDs is roughly 4 KB of query string, comfortably inside the smallest
// URL limit anything in the request path is likely to enforce.
export function chunk<T>(items: T[], size = 100): T[][] {
  if (items.length <= size) return items.length ? [items] : []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
