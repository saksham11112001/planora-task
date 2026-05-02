export function InvoicesSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-7 w-24 rounded-md bg-[var(--bg-hover)]" />
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
          <div className="h-8 w-28 rounded-md bg-[var(--bg-hover)]" />
        </div>
      </div>
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border)]">
        <div className="h-8 w-44 rounded-md bg-[var(--bg-hover)]" />
        <div className="h-8 w-32 rounded-md bg-[var(--bg-hover)]" />
        <div className="ml-auto h-8 w-24 rounded-md bg-[var(--bg-hover)]" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-2 mb-1">
          {[120, 80, 100, 80, 80].map((w, i) => (
            <div key={i} className="h-3 rounded bg-[var(--bg-hover)]" style={{ width: w }} />
          ))}
        </div>
        <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 bg-[var(--bg-card)]">
              <div className="h-4 w-28 rounded bg-[var(--bg-hover)]" />
              <div className="h-4 flex-1 rounded bg-[var(--bg-hover)]" style={{ width: `${50 + (i * 13) % 30}%` }} />
              <div className="h-5 w-20 rounded-full bg-[var(--bg-hover)]" />
              <div className="h-4 w-20 rounded bg-[var(--bg-hover)]" />
              <div className="h-4 w-16 rounded bg-[var(--bg-hover)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
