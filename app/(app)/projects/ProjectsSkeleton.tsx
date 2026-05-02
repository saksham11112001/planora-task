export function ProjectsSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-7 w-28 rounded-md bg-[var(--bg-hover)]" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-md bg-[var(--bg-hover)]" />
          <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border)]">
        <div className="h-8 w-48 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-32 rounded-md bg-[var(--bg-hover)]" />
        <div className="ml-auto h-8 w-8 rounded-md bg-[var(--bg-hover)]" />
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[var(--bg-hover)]" />
                  <div className="h-5 rounded bg-[var(--bg-hover)]" style={{ width: `${80 + (i * 19) % 60}px` }} />
                </div>
                <div className="h-5 w-16 rounded-full bg-[var(--bg-hover)]" />
              </div>
              <div className="h-3 rounded bg-[var(--bg-hover)] mb-2 w-2/3" />
              <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--bg-hover)]" />
              <div className="flex justify-between mt-2">
                <div className="h-3 w-16 rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-10 rounded bg-[var(--bg-hover)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
