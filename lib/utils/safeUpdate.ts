/**
 * Strip the columns a client must never choose for itself.
 *
 * Several routes write a PATCH body straight into a row with `{ ...body }`.
 * That is convenient and, for ordinary fields, fine — but the spread also
 * accepts any column the caller invents, including the ones that decide WHO
 * OWNS the row.
 *
 * The subtle part: scoping the query does not save you. A route that writes
 *
 *     .update({ ...body }).eq('id', x).eq('org_id', mb.org_id)
 *
 * is scoped on the WHERE side only. `org_id` in the body lands in the SET
 * clause, so the caller cannot touch another org's row but CAN push their own
 * row into another org — a one-way write across the tenant boundary. Same for
 * `created_by` (forging authorship) and `id` (rewriting a primary key).
 *
 * So: take ownership from the session, never from the request. Call this on
 * any body that is about to be spread into an insert or update.
 */
const IDENTITY_COLUMNS = [
  'id',
  'org_id',
  'user_id',
  'created_by',
  'created_at',
] as const

export function stripIdentityFields<T extends Record<string, unknown>>(
  body: T,
  extra: readonly string[] = [],
): Partial<T> {
  const blocked = new Set<string>([...IDENTITY_COLUMNS, ...extra])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body ?? {})) {
    if (blocked.has(k)) continue
    out[k] = v
  }
  return out as Partial<T>
}
