import { cn } from '@/lib/utils/cn'
import { PRIORITY_CONFIG, STATUS_CONFIG, PROJECT_STATUS_CONFIG } from '@/types'
import type { TaskPriority, TaskStatus, ProjectStatus, PlanTier } from '@/types'

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const c = PRIORITY_CONFIG[priority]
  if (!c || priority === 'none') return null
  return (
    <span className="priority-chip" style={{ background: c.bg, color: c.color }}>
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }}/>
      {c.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span className="status-badge" style={{ background: c.bg, color: c.color }}>
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }}/>
      {c.label}
    </span>
  )
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const c = PROJECT_STATUS_CONFIG[status]
  return (
    <span className="status-badge" style={{ background: c.bg, color: c.color }}>{c.label}</span>
  )
}

export function PlanBadge({ plan }: { plan: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    free:     { label: 'Free',     bg: '#f1f5f9', color:'var(--text-secondary)' },
    starter:  { label: 'Starter',  bg: '#eff6ff', color: '#1d4ed8' },
    pro:      { label: 'Pro',      bg: '#faf5ff', color: '#7c3aed' },
    business: { label: 'Business', bg: '#f0fdfa', color: '#0d9488' },
  }
  const c = cfg[plan] ?? cfg.free
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    owner:   { label: 'Owner',   color: '#0d9488', bg: '#f0fdfa' },
    admin:   { label: 'Admin',   color: '#7c3aed', bg: '#faf5ff' },
    manager: { label: 'Manager', color: '#ca8a04', bg: '#fffbeb' },
    member:  { label: 'Member',  color:'var(--text-secondary)', bg: '#f1f5f9' },
    viewer:  { label: 'Viewer',  color:'var(--text-muted)', bg: '#f8fafc' },
  }
  const c = cfg[role] ?? cfg.member
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

export function Avatar({ name, size = 'sm', color }: { name: string; size?: 'xs'|'sm'|'md'|'lg'; color?: string }) {
  const sz = { xs: 'h-5 w-5 text-xs', sm: 'h-7 w-7 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-sm' }
  const bg = color ?? '#0d9488'
  const initials = name.split(' ').slice(0,2).map(p => p[0]?.toUpperCase() ?? '').join('')
  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0', sz[size])}
      style={{ background: bg }}>
      {initials}
    </div>
  )
}
