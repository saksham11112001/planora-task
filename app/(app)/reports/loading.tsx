import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ flex: 1, padding: '24px 28px', background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page title + date range picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Skeleton style={{ height: 24, width: 120, borderRadius: 7 }}/>
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton style={{ height: 34, width: 140, borderRadius: 8 }}/>
          <Skeleton style={{ height: 34, width: 80, borderRadius: 8 }}/>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 10,
            border: '1px solid var(--border)', padding: '16px 18px' }}>
            <Skeleton style={{ height: 11, width: 80, borderRadius: 4, marginBottom: 10 }}/>
            <Skeleton style={{ height: 30, width: 60, borderRadius: 6, marginBottom: 6 }}/>
            <Skeleton style={{ height: 10, width: 100, borderRadius: 4 }}/>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Bar chart */}
        <div style={{ background: 'var(--surface)', borderRadius: 12,
          border: '1px solid var(--border)', padding: '18px 20px' }}>
          <Skeleton style={{ height: 14, width: 140, borderRadius: 5, marginBottom: 20 }}/>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
            {[55, 80, 40, 95, 65, 70, 50, 85, 45, 75].map((h, i) => (
              <Skeleton key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0' }}/>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <Skeleton key={i} style={{ flex: 1, height: 9, borderRadius: 3 }}/>
            ))}
          </div>
        </div>

        {/* Donut / pie */}
        <div style={{ background: 'var(--surface)', borderRadius: 12,
          border: '1px solid var(--border)', padding: '18px 20px' }}>
          <Skeleton style={{ height: 14, width: 110, borderRadius: 5, marginBottom: 20 }}/>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <Skeleton style={{ width: 110, height: 110, borderRadius: '50%' }}/>
          </div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Skeleton style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }}/>
              <Skeleton style={{ height: 11, flex: 1, borderRadius: 4 }}/>
              <Skeleton style={{ height: 11, width: 28, borderRadius: 4, flexShrink: 0 }}/>
            </div>
          ))}
        </div>
      </div>

      {/* Data table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton style={{ height: 14, width: 130, borderRadius: 5 }}/>
          <Skeleton style={{ height: 28, width: 90, borderRadius: 7 }}/>
        </div>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
            borderBottom: i < 4 ? '1px solid var(--border-light)' : undefined }}>
            <Skeleton style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }}/>
            <Skeleton style={{ height: 13, flex: 1, borderRadius: 4 }}/>
            <Skeleton style={{ height: 13, width: 60, borderRadius: 4, flexShrink: 0 }}/>
            <Skeleton style={{ height: 20, width: 52, borderRadius: 99, flexShrink: 0 }}/>
          </div>
        ))}
      </div>
    </div>
  )
}
