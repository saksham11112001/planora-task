export function ReportsSkeleton() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--surface-subtle)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }} className="animate-pulse">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="h-7 w-24 rounded-md bg-[var(--bg-hover)] mb-2" />
            <div className="h-4 w-44 rounded bg-[var(--bg-hover)]" />
          </div>
          <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[['#f0fdfa','#0d9488'], ['#f0fdf4','#16a34a'], ['#fef2f2','#dc2626'], ['#f5f3ff','#7c3aed']].map(([bg, border], i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}22` }}>
              <div className="h-3 w-20 rounded bg-[var(--bg-hover)] mb-3" />
              <div className="h-8 w-12 rounded bg-[var(--bg-hover)] mb-2" />
              <div className="h-3 w-16 rounded bg-[var(--bg-hover)]" />
            </div>
          ))}
        </div>

        {/* Chart placeholders */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="h-4 w-32 rounded bg-[var(--bg-hover)] mb-4" />
              <div className="h-40 rounded-lg bg-[var(--bg-hover)]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="h-4 w-28 rounded bg-[var(--bg-hover)] mb-4" />
              <div className="h-32 rounded-lg bg-[var(--bg-hover)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
