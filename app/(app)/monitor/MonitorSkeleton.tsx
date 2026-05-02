export function MonitorSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[var(--border)]">
        <div className="h-7 w-28 rounded-md bg-[var(--bg-hover)]" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-md bg-[var(--bg-hover)]" />
          <div className="h-8 w-24 rounded-md bg-[var(--bg-hover)]" />
        </div>
      </div>
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border)]">
        {[48, 64, 56, 72, 56].map((w, i) => (
          <div key={i} className="h-7 rounded-full bg-[var(--bg-hover)]" style={{ width: w }} />
        ))}
        <div className="ml-auto h-8 w-40 rounded-md bg-[var(--bg-hover)]" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="h-4 w-4 rounded border border-[var(--border)] flex-shrink-0" />
            <div className="flex-1 h-4 rounded bg-[var(--bg-hover)]" style={{ width: `${40 + (i * 17) % 45}%` }} />
            <div className="h-5 w-14 rounded-full bg-[var(--bg-hover)]" />
            <div className="h-5 w-20 rounded bg-[var(--bg-hover)]" />
            <div className="h-5 w-16 rounded bg-[var(--bg-hover)]" />
            <div className="h-6 w-6 rounded-full bg-[var(--bg-hover)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
