import { TaskListSkeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', padding: '0 20px', flexShrink: 0 }}>
        {['List', 'Board'].map(t => (
          <div key={t} style={{ padding: '10px 15px', fontSize: 14, fontWeight: 500,
            color: t === 'List' ? 'var(--brand)' : 'var(--text-muted)',
            borderBottom: t === 'List' ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1 }}>
            {t}
          </div>
        ))}
      </div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 7rem 5rem 6rem 5rem 4.5rem',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-subtle)', flexShrink: 0 }}>
        {['Task', 'Frequency', 'Next due', 'Assignee', 'Client', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i > 0 ? 'center' : 'left' }}>
            {h}
          </div>
        ))}
      </div>
      <TaskListSkeleton rows={7}/>
    </div>
  )
}