import { KanbanSkeleton } from '@/components/ui/Skeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Project header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <Skeleton style={{ width: 32, height: 32, borderRadius: 8 }}/>
        <div>
          <Skeleton style={{ height: 16, width: 180, borderRadius: 5, marginBottom: 5 }}/>
          <Skeleton style={{ height: 11, width: 120, borderRadius: 4 }}/>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Skeleton style={{ height: 30, width: 80, borderRadius: 8 }}/>
          <Skeleton style={{ height: 30, width: 96, borderRadius: 8 }}/>
        </div>
      </div>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', padding: '0 20px', flexShrink: 0 }}>
        {['Board', 'List'].map(t => (
          <div key={t} style={{ padding: '10px 15px', fontSize: 14, fontWeight: 500,
            color: t === 'Board' ? 'var(--brand)' : 'var(--text-muted)',
            borderBottom: t === 'Board' ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1 }}>
            {t}
          </div>
        ))}
      </div>
      <KanbanSkeleton cols={4}/>
    </div>
  )
}
