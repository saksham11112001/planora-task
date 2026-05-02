export function RecurringSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-7 w-32 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
      </div>
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border)]">
        <div className="h-8 w-44 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)]">
              <div className="h-4 w-4 rounded border border-[var(--border)] flex-shrink-0" />
              <div className="flex-1 h-4 rounded bg-[var(--bg-hover)]" style={{ width: `${50 + (i * 13) % 35}%` }} />
              <div className="h-5 w-16 rounded-full bg-[var(--bg-hover)]" />
              <div className="h-5 w-24 rounded bg-[var(--bg-hover)]" />
              <div className="h-6 w-6 rounded-full bg-[var(--bg-hover)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
