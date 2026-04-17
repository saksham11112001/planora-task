import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
      padding: '24px 28px', background: 'var(--surface-subtle)', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Skeleton style={{ height: 24, width: 110, borderRadius: 7, marginBottom: 6 }}/>
          <Skeleton style={{ height: 13, width: 200, borderRadius: 5 }}/>
        </div>
        <Skeleton style={{ height: 36, width: 130, borderRadius: 9 }}/>
      </div>

      {/* Project cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 12,
            border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Color band */}
            <Skeleton style={{ height: 5, borderRadius: 0, opacity: 0.6 }}/>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <Skeleton style={{ height: 15, width: '80%', borderRadius: 5, marginBottom: 6 }}/>
                  <Skeleton style={{ height: 11, width: '60%', borderRadius: 4 }}/>
                </div>
                <Skeleton style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginLeft: 8 }}/>
              </div>
              {/* Progress bar */}
              <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', marginBottom: 12, overflow: 'hidden' }}>
                <Skeleton style={{ height: '100%', width: `${30 + (i * 13) % 55}%`, borderRadius: 99 }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Avatar stack */}
                <div style={{ display: 'flex', gap: -4 }}>
                  {[0, 1, 2].map(a => (
                    <Skeleton key={a} style={{ width: 22, height: 22, borderRadius: '50%',
                      marginLeft: a > 0 ? -6 : 0, border: '2px solid var(--surface)' }}/>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ height: 11, width: 40, borderRadius: 4 }}/>
                  <Skeleton style={{ height: 20, width: 50, borderRadius: 99 }}/>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
