export function TasksSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-8 w-24 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-32 rounded-md bg-[var(--bg-hover)]" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border)]">
        <div className="h-8 w-48 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
        <div className="ml-auto h-8 w-24 rounded-md bg-[var(--bg-hover)]" />
      </div>

      {/* Section + rows */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {[
          { label: 'Overdue', rows: 2, color: '#dc2626' },
          { label: 'Today', rows: 3, color: '#0d9488' },
          { label: 'This week', rows: 4, color: 'var(--text-secondary)' },
        ].map(({ label, rows, color }) => (
          <div key={label}>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full" style={{ background: color }} />
              <div className="h-4 w-20 rounded bg-[var(--bg-hover)]" />
              <div className="h-4 w-6 rounded bg-[var(--bg-hover)]" />
            </div>
            {/* Task rows */}
            <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)]">
                  <div className="h-4 w-4 rounded border border-[var(--border)] flex-shrink-0" />
                  <div className="flex-1 h-4 rounded bg-[var(--bg-hover)]" style={{ width: `${55 + (i * 13) % 35}%` }} />
                  <div className="h-5 w-14 rounded-full bg-[var(--bg-hover)]" />
                  <div className="h-5 w-20 rounded bg-[var(--bg-hover)]" />
                  <div className="h-6 w-6 rounded-full bg-[var(--bg-hover)]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
