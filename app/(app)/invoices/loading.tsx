export default function InvoicesLoading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header skeleton */}
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--border)', animation: 'pulse 1.5s infinite' }}/>
            <div>
              <div style={{ width: 80, height: 16, borderRadius: 6, background: 'var(--border)', marginBottom: 4 }}/>
              <div style={{ width: 120, height: 11, borderRadius: 6, background: 'var(--border)' }}/>
            </div>
          </div>
          <div style={{ width: 130, height: 34, borderRadius: 8, background: 'var(--border)' }}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 58, borderRadius: 8, background: 'var(--border)' }}/>
          ))}
        </div>
      </div>
      {/* Row skeletons */}
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              borderBottom: i < 5 ? '1px solid var(--border-light)' : 'none' }}>
              <div style={{ flex: 1, height: 14, borderRadius: 6, background: 'var(--border)' }}/>
              <div style={{ width: 90, height: 12, borderRadius: 6, background: 'var(--border)' }}/>
              <div style={{ width: 60, height: 12, borderRadius: 6, background: 'var(--border)' }}/>
              <div style={{ width: 80, height: 12, borderRadius: 6, background: 'var(--border)' }}/>
              <div style={{ width: 70, height: 24, borderRadius: 20, background: 'var(--border)' }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
