import { cn } from '@/lib/utils/cn'

// Shimmer keyframes — injected once; browsers ignore duplicate @keyframes with identical content
const SHIMMER_CSS = `
  @keyframes shimmer {
    0%   { background-position: -400% 0; }
    100% { background-position: 400% 0; }
  }
`

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div
        className={cn('rounded', className)}
        style={{
          background: 'linear-gradient(90deg, var(--border) 25%, rgba(255,255,255,0.28) 50%, var(--border) 75%)',
          backgroundSize: '400% 100%',
          animation: 'shimmer 1.6s ease-in-out infinite',
          ...style,
        }}
      />
    </>
  )
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
          borderBottom: '1px solid var(--border-light)' }}>
          <Skeleton style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0 }}/>
          <Skeleton style={{ height: 13, flex: 1, borderRadius: 6 }}/>
          <Skeleton style={{ height: 13, width: 80, borderRadius: 6, flexShrink: 0 }}/>
          <Skeleton style={{ height: 13, width: 64, borderRadius: 6, flexShrink: 0 }}/>
        </div>
      ))}
    </div>
  )
}

// Richer skeleton for task list pages — shows realistic task row shape
export function TaskListSkeleton({ rows = 6 }: { rows?: number }) {
  const widths = ['75%', '55%', '85%', '45%', '70%', '60%']
  return (
    <div style={{ flex: 1, background: 'var(--surface-subtle)' }}>
      {/* Column header */}
      <div style={{ display: 'grid', gridTemplateColumns: '28px 22px 1fr 160px 100px 110px',
        padding: '8px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {[28, 22, 0, 160, 100, 110].map((w, i) => (
          <Skeleton key={i} style={{ height: 10, width: w || '60%', borderRadius: 4,
            opacity: 0.5, animationDelay: `${i * 0.05}s` }}/>
        ))}
      </div>
      {/* Section label */}
      <div style={{ padding: '13px 18px 5px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Skeleton style={{ height: 10, width: 80, borderRadius: 4 }}/>
        <Skeleton style={{ height: 10, width: 24, borderRadius: 4 }}/>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 22px 1fr 160px 100px 110px',
          alignItems: 'center', padding: '0 18px', minHeight: 48,
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--surface)' }}>
          <Skeleton style={{ width: 13, height: 13, borderRadius: 3 }}/>
          <Skeleton style={{ width: 16, height: 16, borderRadius: '50%' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
            <Skeleton style={{ height: 13, width: widths[i % widths.length], borderRadius: 4 }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Skeleton style={{ width: 24, height: 24, borderRadius: '50%' }}/>
            <Skeleton style={{ height: 12, width: 80, borderRadius: 4 }}/>
          </div>
          <Skeleton style={{ height: 12, width: 60, borderRadius: 4, margin: '0 auto' }}/>
          <Skeleton style={{ height: 20, width: 64, borderRadius: 99, margin: '0 auto' }}/>
        </div>
      ))}
    </div>
  )
}

// Kanban board skeleton
export function KanbanSkeleton({ cols = 4 }: { cols?: number }) {
  const LABELS = ['Overdue', 'To do', 'Pending approval', 'Done']
  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px 20px', background: 'var(--surface-subtle)', flex: 1 }}>
      {Array.from({ length: cols }).map((_, col) => (
        <div key={col} style={{ width: 268, flexShrink: 0, borderRadius: 10,
          background: 'var(--border-light)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 13px',
            borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <Skeleton style={{ width: 9, height: 9, borderRadius: '50%' }}/>
            <Skeleton style={{ height: 13, width: 90, borderRadius: 4 }}/>
          </div>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {Array.from({ length: col === 0 ? 2 : col === 3 ? 3 : 4 }).map((_, card) => (
              <div key={card} style={{ background: 'var(--surface)', borderRadius: 8,
                padding: '10px 11px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <Skeleton style={{ width: 15, height: 15, borderRadius: '50%', flexShrink: 0 }}/>
                  <Skeleton style={{ height: 13, flex: 1, borderRadius: 4 }}/>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton style={{ height: 20, width: 56, borderRadius: 5 }}/>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Skeleton style={{ height: 11, width: 36, borderRadius: 4 }}/>
                    <Skeleton style={{ width: 20, height: 20, borderRadius: '50%' }}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
