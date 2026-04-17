import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="page-container">
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Skeleton style={{ height: 14, width: 60, borderRadius: 6, marginBottom: 24 }}/>
        <Skeleton style={{ height: 28, width: 160, borderRadius: 8, marginBottom: 24 }}/>
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 24 }}>
          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
            paddingBottom: 24, borderBottom: '1px solid var(--border-light)' }}>
            <Skeleton style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <Skeleton style={{ height: 18, width: 140, borderRadius: 6, marginBottom: 8 }}/>
              <Skeleton style={{ height: 13, width: 180, borderRadius: 5 }}/>
            </div>
          </div>
          {/* Form fields */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{ marginBottom: 20 }}>
              <Skeleton style={{ height: 13, width: 80, borderRadius: 5, marginBottom: 8 }}/>
              <Skeleton style={{ height: 38, borderRadius: 8 }}/>
            </div>
          ))}
          {/* Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Skeleton style={{ height: 36, width: 100, borderRadius: 8 }}/>
          </div>
        </div>
      </div>
    </div>
  )
}
