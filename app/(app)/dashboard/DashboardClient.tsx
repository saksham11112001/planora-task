'use client'
import Link from 'next/link'
import { ArrowRight, CheckSquare, FolderOpen, Users2, BarChart2,
         Calendar, Clock, AlertCircle, CheckCircle2, TrendingUp,
         Star, Zap, RefreshCw, Plus } from 'lucide-react'
import { fmtDate } from '@/lib/utils/format'

interface Props {
  greeting: string; name: string; today: string
  overdueCount: number; todayCount: number; pendingCount: number
  completedThisMonth: number; totalThisMonth: number; completionRate: number
  myTasks: { id:string; title:string; status:string; due_date:string|null; project_id:string|null; is_recurring?:boolean; projects: any }[]
  activeProjects: { id:string; name:string; color:string; due_date:string|null; clients: any }[]
  recentClients: { id:string; name:string; color:string }[]
}

const QUICK_ACTIONS = [
  { icon: CheckSquare, label: 'Add task',       href: '/inbox',        color: '#0d9488' },
  { icon: FolderOpen,  label: 'New project',    href: '/projects/new', color: '#7c3aed' },
  { icon: Users2,      label: 'Add client',     href: '/clients/new',  color: '#0891b2' },
  { icon: RefreshCw,   label: 'Recurring task', href: '/recurring',    color: '#ea580c' },
  { icon: Calendar,    label: 'Calendar',        href: '/calendar',     color: '#16a34a' },
  { icon: BarChart2,   label: 'Reports',         href: '/reports',      color: '#ca8a04' },
]

function MiniAppCard({ title, color, tasks }: { title: string; color: string; tasks: string[] }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.07)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12, padding: '12px 14px', minWidth: 160,
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      border: '1px solid rgba(255,255,255,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }}/>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', overflow: 'hidden',
          whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title}</span>
      </div>
      {tasks.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <div style={{ width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
            background: i === 0 ? color : 'transparent',
            border: i === 0 ? 'none' : '1.5px solid rgba(255,255,255,0.2)' }}/>
          <span style={{ fontSize: 10,
            color: i === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.75)',
            textDecoration: i === 0 ? 'line-through' : 'none',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{t}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 99 }}>
        <div style={{ width: `${Math.round(100 / tasks.length)}%`, height: '100%',
          background: color, borderRadius: 99 }}/>
      </div>
    </div>
  )
}

export function DashboardClient({
  greeting, name, today,
  overdueCount, todayCount, pendingCount,
  completedThisMonth, totalThisMonth, completionRate,
  myTasks, activeProjects, recentClients,
}: Props) {

  const statusMsg = overdueCount > 0
    ? { text: `${overdueCount} task${overdueCount > 1 ? 's' : ''} overdue — let's clear them`, color: '#fecaca' }
    : todayCount > 0
    ? { text: `${todayCount} task${todayCount > 1 ? 's' : ''} due today`, color: '#99f6e4' }
    : { text: "You're all caught up — great work! 🎉", color: '#bbf7d0' }

  return (
    <div className="page-container">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f766e 100%)',
        borderRadius: 20, marginBottom: 24, overflow: 'hidden', position: 'relative',
      }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280,
          borderRadius: '50%', background: 'rgba(13,148,136,0.12)' }}/>
        <div style={{ position: 'absolute', bottom: -40, right: 200, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(124,58,237,0.1)' }}/>
        <div style={{ position: 'absolute', top: 20, left: 300, width: 80, height: 80,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}/>

        <div style={{ display: 'flex', alignItems: 'center', padding: '32px 36px', gap: 40 }}>
          {/* Left: greeting + CTA */}
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            {/* Status pill */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 99, marginBottom: 14,
              background: 'rgba(255,255,255,0.1)', border: `1px solid ${statusMsg.color}40` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusMsg.color }}/>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                {statusMsg.text}
              </span>
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 8, letterSpacing: '-0.5px' }}>
              {greeting}, {name}!
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 22, lineHeight: 1.6 }}>
              Your workspace is ready. {totalThisMonth > 0
                ? `You've completed ${completedThisMonth} of ${totalThisMonth} tasks this month.`
                : 'Start by creating your first task or project.'}
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/inbox" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 10,
                background: '#0d9488', color: '#fff', textDecoration: 'none',
                fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px rgba(13,148,136,0.5)',
                transition: 'all 0.15s',
              }}>
                <Plus style={{ width: 14, height: 14 }}/> New task
              </Link>
              <Link href="/projects/new" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 10,
                background: 'rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none',
                fontSize: 13, fontWeight: 500, border: '1px solid rgba(255,255,255,0.2)',
                transition: 'all 0.15s',
              }}>
                <FolderOpen style={{ width: 14, height: 14 }}/> New project
              </Link>
              <Link href="/calendar" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 10,
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <Calendar style={{ width: 14, height: 14 }}/> Calendar
              </Link>
            </div>
          </div>

          {/* Right: mini app previews */}
          <div style={{ display: 'flex', gap: 12, flexShrink: 0, position: 'relative', zIndex: 1 }}
            className="hidden lg:flex">
            <MiniAppCard title="Website Redesign" color="#0d9488"
              tasks={['Homepage copy review','SEO audit','Brand refresh','Launch checklist']}/>
            <div style={{ marginTop: 20 }}>
              <MiniAppCard title="Client Onboarding" color="#7c3aed"
                tasks={['Intro call complete','Send contract','Setup workspace','Handover call']}/>
            </div>
          </div>
        </div>

        {/* Bottom stats strip */}
        <div style={{
          display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {[
            { label: 'Completed this month', value: completedThisMonth, color: '#4ade80' },
            { label: 'Due today',             value: todayCount,          color: '#60a5fa' },
            { label: 'Overdue',               value: overdueCount,         color: overdueCount > 0 ? '#f87171' : '#4ade80' },
            { label: 'Completion rate',       value: `${completionRate}%`, color: '#a78bfa' },
          ].map((stat, i) => (
            <div key={i} style={{ flex: 1, padding: '14px 20px',
              borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: 4 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 24 }}>
        {QUICK_ACTIONS.map(({ icon: Icon, label, href, color }) => (
          <Link key={href} href={href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '14px 10px', background: 'var(--surface)',
            border: `1px solid var(--border)`, borderRadius: 12,
            textDecoration: 'none', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${color}60`; el.style.background = `${color}12`; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 6px 20px ${color}20` }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--surface)'; el.style.transform = ''; el.style.boxShadow = '' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon style={{ width: 17, height: 17, color }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
              textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 20 }}>

        {/* My tasks */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>My tasks</h2>
            <Link href="/tasks" style={{ display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 500 }}>
              View all <ArrowRight style={{ width: 12, height: 12 }}/>
            </Link>
          </div>
          <div className="card-elevated" style={{ overflow: 'hidden' }}>
            {myTasks && myTasks.length > 0 ? myTasks.map((task, i) => {
              const isOv   = task.due_date && task.due_date < today
              const proj   = task.projects as unknown as { id: string; name: string; color: string } | null
              const isLast = i === myTasks.length - 1
              return (
                <Link key={task.id} href="/tasks" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                  textDecoration: 'none', background: 'transparent', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: isOv ? '#dc2626' : proj?.color ?? 'var(--brand)' }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 1 }}>
                      {task.title}
                    </p>
                    {proj && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: 1,
                          background: proj.color, display: 'inline-block' }}/>
                        {proj.name}
                      </span>
                    )}
                  </div>
                  {task.due_date && (
                    <span style={{ fontSize: 11, flexShrink: 0, fontWeight: isOv ? 600 : 400,
                      color: isOv ? '#dc2626' : task.due_date === today ? 'var(--brand)' : '#94a3b8' }}>
                      {isOv ? 'Overdue' : task.due_date === today ? 'Today' : fmtDate(task.due_date)}
                    </span>
                  )}
                </Link>
              )
            }) : (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: 32, height: 32, color: 'var(--border)', margin: '0 auto 10px' }}/>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  No tasks assigned to you yet
                </p>
                <Link href="/inbox" style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 500 }}>
                  <Plus style={{ width: 12, height: 12 }}/> Create a task
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Progress ring card */}
          <div className="card-elevated" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <TrendingUp style={{ width: 15, height: 15, color: 'var(--brand)' }}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>This month</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Mini ring */}
              <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border-light)" strokeWidth="5"/>
                  <circle cx="28" cy="28" r="22" fill="none"
                    stroke={completionRate >= 70 ? '#16a34a' : 'var(--brand)'}
                    strokeWidth="5"
                    strokeDasharray={`${(completionRate / 100) * 138.2} 138.2`}
                    strokeLinecap="round"/>
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 12, fontWeight: 800,
                  color: completionRate >= 70 ? '#16a34a' : 'var(--brand)' }}>
                  {completionRate}%
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Done</span>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>{completedThisMonth}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Created</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalThisMonth}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active projects */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Projects</h2>
              <Link href="/projects" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none' }}>View all</Link>
            </div>
            <div className="card-elevated" style={{ overflow: 'hidden' }}>
              {activeProjects && activeProjects.length > 0 ? activeProjects.map((p, i) => {
                const client = p.clients as unknown as { id:string; name:string; color:string } | null
                const isLast = i === activeProjects.length - 1
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                    textDecoration: 'none', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <div style={{ width: 8, height: 8, borderRadius: 2,
                      background: p.color, flexShrink: 0 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</p>
                      {client && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{client.name}</p>}
                    </div>
                    {p.due_date && <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{fmtDate(p.due_date)}</span>}
                  </Link>
                )
              }) : (
                <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>No active projects</p>
                  <Link href="/projects/new" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none' }}>Create one →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Clients */}
          {recentClients && recentClients.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Clients</h2>
                <Link href="/clients" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none' }}>View all</Link>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {recentClients.map(c => (
                  <Link key={c.id} href={`/clients/${c.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 99, fontSize: 11, fontWeight: 500,
                    color: 'var(--text-primary)', textDecoration: 'none', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.color; el.style.background = c.color + '12' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--surface)' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }}/>
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}