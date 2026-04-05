export default function Loading() {
  return (
    <div className="page-container">
      <style>{`
        @keyframes skeletonPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        .sk { background:var(--border); border-radius:6px; animation:skeletonPulse 1.4s ease-in-out infinite; }
      `}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Hero header skeleton */}
        <div style={{ borderRadius: 16, padding: '28px 32px', marginBottom: 24,
          background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)',
          display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11,
            background: 'rgba(255,255,255,0.15)', flexShrink: 0 }}/>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 22, width: 240, borderRadius: 6, background: 'rgba(255,255,255,0.15)' }}/>
            <div style={{ height: 14, width: 340, borderRadius: 6, background: 'rgba(255,255,255,0.08)' }}/>
          </div>
        </div>

        {/* Group filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[80, 92, 104, 78, 96, 86].map((w, i) => (
            <div key={i} className="sk" style={{ height: 30, width: w, borderRadius: 20 }}/>
          ))}
        </div>

        {/* Task groups */}
        {[0, 1, 2].map(gi => (
          <div key={gi} style={{ marginBottom: 24, border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden' }}>
            {/* Group header */}
            <div style={{ padding: '14px 18px', background: 'var(--surface-alt)',
              display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{ width: 20, height: 20 }}/>
              <div className="sk" style={{ height: 16, width: 140 }}/>
              <div className="sk" style={{ height: 20, width: 40, borderRadius: 10, marginLeft: 'auto' }}/>
            </div>
            {/* Task rows */}
            {[0, 1, 2, 3].map(ti => (
              <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px', borderTop: '1px solid var(--border-light)' }}>
                <div className="sk" style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }}/>
                <div className="sk" style={{ height: 13, flex: 1 }}/>
                <div className="sk" style={{ height: 22, width: 64, flexShrink: 0 }}/>
                <div className="sk" style={{ height: 22, width: 56, flexShrink: 0 }}/>
                <div className="sk" style={{ height: 28, width: 60, flexShrink: 0 }}/>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
