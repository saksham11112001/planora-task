export function ApprovalsSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-7 w-28 rounded-md bg-[var(--bg-hover)]" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="h-4 w-40 rounded bg-[var(--bg-hover)]" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="h-4 rounded bg-[var(--bg-hover)]" style={{ width: `${55 + (i * 15) % 30}%` }} />
                <div className="h-5 w-20 rounded-full bg-[var(--bg-hover)]" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-24 rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-20 rounded bg-[var(--bg-hover)]" />
                <div className="ml-auto flex gap-2">
                  <div className="h-7 w-20 rounded-md bg-[var(--bg-hover)]" />
                  <div className="h-7 w-20 rounded-md bg-[var(--bg-hover)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
