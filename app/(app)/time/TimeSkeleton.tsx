export function TimeSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header + date range */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-7 w-32 rounded-md bg-[var(--bg-hover)]" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
          <div className="h-4 w-4 rounded bg-[var(--bg-hover)]" />
          <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 px-6 py-4 border-b border-[var(--border)]">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 flex-1">
            <div className="h-3 w-20 rounded bg-[var(--bg-hover)] mb-2" />
            <div className="h-6 w-14 rounded bg-[var(--bg-hover)]" />
          </div>
        ))}
        <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)] self-center ml-auto" />
      </div>

      {/* Log rows */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 bg-[var(--bg-card)]">
              <div className="h-4 w-24 rounded bg-[var(--bg-hover)]" />
              <div className="flex-1 h-4 rounded bg-[var(--bg-hover)]" style={{ width: `${40 + (i * 11) % 35}%` }} />
              <div className="h-5 w-16 rounded-full bg-[var(--bg-hover)]" />
              <div className="h-4 w-12 rounded bg-[var(--bg-hover)]" />
              <div className="h-6 w-6 rounded-full bg-[var(--bg-hover)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
