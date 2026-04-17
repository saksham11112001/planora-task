import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
      padding: '24px 28px', background: 'var(--surface-subtle)', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Skeleton style={{ height: 24, width: 100, borderRadius: 7, marginBottom: 6 }}/>
          <Skeleton style={{ height: 13, width: 180, borderRadius: 5 }}/>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton style={{ height: 36, width: 110, borderRadius: 9 }}/>
          <Skeleton style={{ height: 36, width: 120, borderRadius: 9 }}/>
        </div>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton style={{ height: 36, flex: 1, borderRadius: 8 }}/>
        <Skeleton style={{ height: 36, width: 80, borderRadius: 8 }}/>
      </div>

      {/* Client cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 10,
            border: '1px solid var(--border)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Skeleton style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                <Skeleton style={{ height: 14, width: '70%', borderRadius: 4, marginBottom: 5 }}/>
                <Skeleton style={{ height: 11, width: '50%', borderRadius: 4 }}/>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <Skeleton style={{ height: 20, width: 56, borderRadius: 99 }}/>
              <Skeleton style={{ height: 20, width: 48, borderRadius: 99 }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton style={{ height: 11, width: 80, borderRadius: 4 }}/>
              <Skeleton style={{ height: 26, width: 60, borderRadius: 7 }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
