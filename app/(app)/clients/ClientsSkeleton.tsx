export function ClientsSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-7 w-24 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
      </div>

      {/* Group filter pills */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border)]">
        {[56, 72, 64, 80].map((w, i) => (
          <div key={i} className="h-7 rounded-full bg-[var(--bg-hover)]" style={{ width: w }} />
        ))}
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-[var(--bg-hover)] flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 rounded bg-[var(--bg-hover)] mb-1.5" style={{ width: `${50 + (i * 17) % 35}%` }} />
                  <div className="h-3 w-20 rounded bg-[var(--bg-hover)]" />
                </div>
              </div>
              <div className="h-3 rounded bg-[var(--bg-hover)] mb-1.5 w-3/4" />
              <div className="h-3 rounded bg-[var(--bg-hover)] w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
