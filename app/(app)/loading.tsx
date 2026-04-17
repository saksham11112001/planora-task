import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: 24, background: 'var(--surface-subtle)', flex: 1 }}>
      {/* Page title + subtitle */}
      <Skeleton style={{ height: 28, width: 200, borderRadius: 8, marginBottom: 8 }}/>
      <Skeleton style={{ height: 14, width: 300, borderRadius: 6, marginBottom: 28 }}/>

      {/* Stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ borderRadius: 10, background: 'var(--surface)',
            border: '1px solid var(--border)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Skeleton style={{ width: 32, height: 32, borderRadius: 8 }}/>
              <Skeleton style={{ height: 12, width: 80, borderRadius: 4 }}/>
            </div>
            <Skeleton style={{ height: 28, width: 60, borderRadius: 6, marginBottom: 8 }}/>
            <Skeleton style={{ height: 11, width: 100, borderRadius: 4 }}/>
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20 }}>
        {/* Task list panel */}
        <div style={{ borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Skeleton style={{ height: 15, width: 120, borderRadius: 5 }}/>
            <Skeleton style={{ height: 28, width: 80, borderRadius: 7 }}/>
          </div>
          {[70, 50, 85, 60, 75, 45].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
              borderBottom: '1px solid var(--border-light)' }}>
              <Skeleton style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0 }}/>
              <Skeleton style={{ height: 13, width: `${w}%`, borderRadius: 4 }}/>
              <Skeleton style={{ height: 20, width: 52, borderRadius: 99, marginLeft: 'auto', flexShrink: 0 }}/>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mini chart / activity */}
          <div style={{ height: 190, borderRadius: 10, background: 'var(--surface)',
            border: '1px solid var(--border)', padding: '14px 18px' }}>
            <Skeleton style={{ height: 14, width: 100, borderRadius: 5, marginBottom: 16 }}/>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
              {[65, 45, 80, 55, 90, 40, 70].map((h, i) => (
                <Skeleton key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0' }}/>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 18px' }}>
            <Skeleton style={{ height: 14, width: 90, borderRadius: 5, marginBottom: 14 }}/>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: i < 2 ? 12 : 0 }}>
                <Skeleton style={{ height: 12, width: 100, borderRadius: 4 }}/>
                <Skeleton style={{ height: 12, width: 30, borderRadius: 4 }}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
