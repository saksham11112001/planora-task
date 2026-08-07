'use client'

/**
 * Warns that a view is showing a capped subset of the data.
 *
 * Every list/report query in the app is capped for safety. When an org exceeds
 * a cap the rows are silently dropped — so counts, KPIs and charts quietly
 * become wrong with nothing on screen to say so. For a compliance product
 * whose numbers get shown to a regulator, a silently-wrong figure is worse
 * than a slow page.
 *
 * Renders nothing in the normal case, so it costs nothing until it matters.
 *
 * `total` is optional: when the caller has run a cheap `{ count: 'exact',
 * head: true }` query the exact figure is shown; otherwise the notice still
 * warns, just without the denominator.
 */
export function TruncationNotice({
  shown,
  cap,
  total,
  noun = 'records',
  hint = 'Narrow the date range or filters to see the rest.',
}: {
  shown: number
  cap: number
  total?: number | null
  noun?: string
  hint?: string
}) {
  // A full page of rows means the cap was almost certainly hit. If an exact
  // total is available, trust that instead — it removes the false positive
  // where the row count lands exactly on the cap by coincidence.
  const truncated = total != null ? total > shown : shown >= cap
  if (!truncated) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 16px', flexShrink: 0,
        background: 'rgba(217,119,6,0.08)',
        borderBottom: '1px solid rgba(217,119,6,0.22)',
        fontSize: 12, color: '#b45309', lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">⚠</span>
      <span>
        <strong style={{ fontWeight: 700 }}>
          Showing {shown.toLocaleString('en-IN')}
          {total != null ? ` of ${total.toLocaleString('en-IN')}` : ''} {noun}.
        </strong>{' '}
        {total != null
          ? `${(total - shown).toLocaleString('en-IN')} are not included in this view or its totals.`
          : 'Older items are not included in this view or its totals.'}{' '}
        {hint}
      </span>
    </div>
  )
}
