import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12,
      padding: '28px 32px', background: 'var(--surface-subtle)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Skeleton style={{ width: 160, height: 28, borderRadius: 8 }}/>
        <Skeleton style={{ width: 120, height: 36, borderRadius: 9 }}/>
      </div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {[72, 88, 96, 80].map((w, i) => (
          <Skeleton key={i} style={{ height: 30, width: w, borderRadius: 20 }}/>
        ))}
      </div>
      {/* Approval rows */}
      {[80, 60, 90, 70, 55, 75, 65].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
          background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
          <Skeleton style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }}/>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Skeleton style={{ width: `${w}%`, height: 13, borderRadius: 4 }}/>
            <Skeleton style={{ width: `${Math.max(30, w - 30)}%`, height: 11, borderRadius: 4 }}/>
          </div>
          <Skeleton style={{ width: 64, height: 22, borderRadius: 99, flexShrink: 0 }}/>
          <Skeleton style={{ width: 80, height: 32, borderRadius: 8, flexShrink: 0 }}/>
        </div>
      ))}
    </div>
  )
}
