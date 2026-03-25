export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ height: 14, width: 60, borderRadius: 6, background: '#e2e8f0', marginBottom: 24, animation: 'pulse 1.5s ease-in-out infinite' }}/>
        <div style={{ height: 28, width: 160, borderRadius: 8, background: '#e2e8f0', marginBottom: 24, animation: 'pulse 1.5s ease-in-out infinite' }}/>
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#e2e8f0', animation: 'pulse 1.5s ease-in-out infinite' }}/>
            <div>
              <div style={{ height: 18, width: 140, borderRadius: 6, background: '#e2e8f0', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }}/>
              <div style={{ height: 13, width: 180, borderRadius: 5, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }}/>
            </div>
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div style={{ height: 13, width: 80, borderRadius: 5, background: '#f1f5f9', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }}/>
              <div style={{ height: 38, borderRadius: 8, background: '#f8fafc', animation: 'pulse 1.5s ease-in-out infinite' }}/>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
