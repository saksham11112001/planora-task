export function CalendarSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Month nav */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-[var(--bg-hover)]" />
          <div className="h-6 w-36 rounded-md bg-[var(--bg-hover)]" />
          <div className="h-8 w-8 rounded-md bg-[var(--bg-hover)]" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-md bg-[var(--bg-hover)]" />
          <div className="h-8 w-20 rounded-md bg-[var(--bg-hover)]" />
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-3 py-2 flex justify-center">
            <div className="h-3 w-8 rounded bg-[var(--bg-hover)]" />
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows: '1fr' }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="border-r border-b border-[var(--border)] p-2">
            <div className="h-5 w-5 rounded-full bg-[var(--bg-hover)] mb-1.5" />
            {i % 4 === 0 && <div className="h-4 rounded bg-[var(--bg-hover)] mb-1 w-full" />}
            {i % 7 === 2 && <div className="h-4 rounded bg-[var(--bg-hover)] w-4/5" />}
          </div>
        ))}
      </div>
    </div>
  )
}
