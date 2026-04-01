import React from 'react'

export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '28px 32px', background: 'var(--surface-subtle)' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 9 }} />
      </div>
      {/* Row skeletons */}
      {[80, 60, 90, 70, 55, 75].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
          <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
          <div className="skeleton" style={{ width: `${w}%`, height: 14, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 99, marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}
