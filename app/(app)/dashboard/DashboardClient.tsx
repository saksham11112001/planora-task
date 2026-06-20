'use client'
import Link from 'next/link'
import { ArrowRight, CheckSquare, FolderOpen, Users2, BarChart2,
         Calendar, CheckCircle2, TrendingUp, RefreshCw, Plus, Sparkles,
         FileCheck, ChevronRight as ChevRight, AlertCircle, Clock,
         Flame, Target, Activity } from 'lucide-react'
import { fmtDate } from '@/lib/utils/format'
import { useState, useEffect } from 'react'

interface Props {
  greeting: string; name: string; today: string
  overdueCount: number; todayCount: number; pendingCount: number
  completedThisMonth: number; totalThisMonth: number; completionRate: number
  weeklyCompleted: number; clientsCount: number; teamCount: number
  myTasks: { id:string; title:string; status:string; due_date:string|null; project_id:string|null; is_recurring?:boolean; projects: any }[]
  activeProjects: { id:string; name:string; color:string; due_date:string|null; clients: any }[]
  recentClients: { id:string; name:string; color:string }[]
  isAdmin?: boolean
}

function AiBriefCard() {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ai/org-summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary) setSummary(d.summary) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!loading && !summary) return null

  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--brand-border)',
      background: 'var(--brand-light)', padding: '14px 16px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sparkles style={{ width: 14, height: 14, color: 'var(--brand)' }}/>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.04em' }}>
          AI BRIEF
        </span>
      </div>
      {loading
        ? <div style={{ height: 36, borderRadius: 6, background: 'rgba(13,148,136,0.15)', animation: 'pulse 1.5s infinite' }}/>
        : <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{summary}</p>
      }
    </div>
  )
}

const QUICK_ACTIONS = [
  { icon: CheckSquare, label: 'Add task',    href: '/inbox',        color: '#0d9488' },
  { icon: FolderOpen,  label: 'New project', href: '/projects/new', color: '#7c3aed' },
  { icon: Users2,      label: 'Add client',  href: '/clients/new',  color: '#0891b2' },
  { icon: RefreshCw,   label: 'Repeat task', href: '/recurring?new=1', color: '#ea580c' },
  { icon: Calendar,    label: 'Calendar',    href: '/calendar',     color: '#16a34a' },
  { icon: BarChart2,   label: 'Reports',     href: '/reports',      color: '#ca8a04' },
]

export function DashboardClient({
  greeting, name, today,
  overdueCount, todayCount, pendingCount,
  completedThisMonth, totalThisMonth, completionRate,
  weeklyCompleted, clientsCount, teamCount,
  myTasks, activeProjects, recentClients, isAdmin,
}: Props) {

  const needsAttention = overdueCount + pendingCount
  const healthScore    = Math.max(0, Math.min(100,
    Math.round(completionRate * 0.5 + (overdueCount === 0 ? 30 : Math.max(0, 30 - overdueCount * 5)) + (pendingCount === 0 ? 20 : 10))
  ))
  const healthColor = healthScore >= 80 ? '#16a34a' : healthScore >= 60 ? '#ca8a04' : '#dc2626'
  const healthLabel = healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Needs attention' : 'At risk'

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
        borderRadius: 20, marginBottom: 20, overflow: 'hidden', position: 'relative',
      }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280,
          borderRadius: '50%', background: 'rgba(13,148,136,0.12)' }}/>
        <div style={{ position: 'absolute', bottom: -40, right: 200, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(124,58,237,0.1)' }}/>
        <div style={{ position: 'absolute', top: 20, left: 320, width: 80, height: 80,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}/>

        <div style={{ display: 'flex', alignItems: 'stretch', padding: '28px 36px', gap: 40 }}>
          {/* Left: greeting + CTA */}
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 99, marginBottom: 14,
              background: 'rgba(255,255,255,0.1)', border: `1px solid ${statusMsg.color}40` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusMsg.color }}/>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                {statusMsg.text}
              </span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 8, letterSpacing: '-0.5px' }}>
              {greeting}, {name}!
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 22, lineHeight: 1.6 }}>
              {totalThisMonth > 0
                ? `${completedThisMonth} of ${totalThisMonth} tasks completed this month · ${weeklyCompleted} this week`
                : 'Your workspace is ready. Start by creating a task or project.'}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/inbox" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10,
                background: '#0d9488', color: '#fff', textDecoration: 'none',
                fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px rgba(13,148,136,0.5)',
              }}>
                <Plus style={{ width: 14, height: 14 }}/> New task
              </Link>
              <Link href="/projects/new" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10,
                background: 'rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none',
                fontSize: 13, fontWeight: 500, border: '1px solid rgba(255,255,255,0.2)',
              }}>
                <FolderOpen style={{ width: 14, height: 14 }}/> New project
              </Link>
              <Link href="/calendar" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10,
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <Calendar style={{ width: 14, height: 14 }}/> Calendar
              </Link>
            </div>
          </div>

          {/* Right: workspace health score */}
          <div style={{
            flexShrink: 0, width: 200, position: 'relative', zIndex: 1,
            background: 'rgba(255,255,255,0.06)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px', gap: 4,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', marginBottom: 8 }}>
              WORKSPACE HEALTH
            </p>
            {/* Score ring */}
            <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 8 }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="32" fill="none"
                  stroke={healthColor} strokeWidth="6"
                  strokeDasharray={`${(healthScore / 100) * 201} 201`}
                  strokeLinecap="round"/>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: healthColor, lineHeight: 1 }}>
                  {healthScore}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>/100</span>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: healthColor }}>{healthLabel}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, width: '100%' }}>
              {[
                { label: 'Clients', value: clientsCount, color: '#60a5fa' },
                { label: 'Team', value: teamCount, color: '#a78bfa' },
                { label: 'Projects', value: activeProjects.length, color: '#4ade80' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom stats strip */}
        <div style={{
          display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {[
            { label: 'Completed this month', value: completedThisMonth, color: '#4ade80', icon: '✅' },
            { label: 'Due today',             value: todayCount,          color: '#60a5fa', icon: '📅' },
            { label: 'Overdue',               value: overdueCount,         color: overdueCount > 0 ? '#f87171' : '#4ade80', icon: overdueCount > 0 ? '🔴' : '✅' },
            { label: 'Completion rate',       value: `${completionRate}%`, color: '#a78bfa', icon: '📈' },
          ].map((stat, i) => (
            <div key={i} style={{ flex: 1, padding: '13px 20px',
              borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: stat.color, lineHeight: 1, marginBottom: 3 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {/* This week */}
        <div style={{ borderRadius: 14, padding: '16px 18px', background: 'var(--surface)',
          border: '1.5px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60,
            borderRadius: '50%', background: 'rgba(234,88,12,0.08)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(234,88,12,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame style={{ width: 15, height: 15, color: '#ea580c' }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>THIS WEEK</span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 900, color: '#ea580c', lineHeight: 1, marginBottom: 4 }}>
            {weeklyCompleted}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            tasks completed{weeklyCompleted > 5 ? ' 🔥 on fire!' : weeklyCompleted > 0 ? ' — keep going!' : ' — start your streak'}
          </p>
        </div>

        {/* Due today */}
        <div style={{ borderRadius: 14, padding: '16px 18px', background: 'var(--surface)',
          border: `1.5px solid ${todayCount > 0 ? '#3b82f640' : 'var(--border)'}`,
          position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60,
            borderRadius: '50%', background: 'rgba(59,130,246,0.07)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock style={{ width: 15, height: 15, color: '#3b82f6' }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>DUE TODAY</span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 900, color: todayCount > 0 ? '#3b82f6' : 'var(--text-muted)', lineHeight: 1, marginBottom: 4 }}>
            {todayCount}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {todayCount > 3 ? 'busy day ahead!' : todayCount > 0 ? `task${todayCount > 1 ? 's' : ''} need your attention` : 'nothing due — you\'re free!'}
          </p>
        </div>

        {/* Needs attention */}
        <div style={{ borderRadius: 14, padding: '16px 18px',
          background: needsAttention > 0 ? 'rgba(220,38,38,0.04)' : 'var(--surface)',
          border: `1.5px solid ${needsAttention > 0 ? '#dc262640' : 'var(--border)'}`,
          position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60,
            borderRadius: '50%', background: needsAttention > 0 ? 'rgba(220,38,38,0.07)' : 'rgba(22,163,74,0.07)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8,
              background: needsAttention > 0 ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle style={{ width: 15, height: 15, color: needsAttention > 0 ? '#dc2626' : '#16a34a' }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>NEEDS ATTENTION</span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 900, color: needsAttention > 0 ? '#dc2626' : '#16a34a', lineHeight: 1, marginBottom: 4 }}>
            {needsAttention}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {needsAttention === 0 ? 'all clear — nothing pending!' : [
              overdueCount > 0 ? `${overdueCount} overdue` : null,
              pendingCount > 0 ? `${pendingCount} approval${pendingCount > 1 ? 's' : ''}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Monthly progress */}
        <div style={{ borderRadius: 14, padding: '16px 18px', background: 'var(--surface)',
          border: '1.5px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60,
            borderRadius: '50%', background: 'rgba(13,148,136,0.07)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(13,148,136,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target style={{ width: 15, height: 15, color: 'var(--brand)' }}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>THIS MONTH</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand)', lineHeight: 1 }}>
              {completionRate}%
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              {completedThisMonth}/{totalThisMonth}
            </p>
          </div>
          {/* Mini progress bar */}
          <div style={{ height: 5, background: 'var(--border-light)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${completionRate}%`,
              background: completionRate >= 70 ? '#16a34a' : 'var(--brand)', transition: 'width 0.6s' }}/>
          </div>
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 24 }}>
        {QUICK_ACTIONS.map(({ icon: Icon, label, href, color }) => (
          <Link key={href} href={href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '14px 10px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 12,
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

      {/* ── First-time setup guide ── */}
      {myTasks.length === 0 && recentClients.length === 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', animation: 'pulse 2s infinite' }}/>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
              🚀 YOUR SETUP GUIDE — Complete these 4 steps to get the most out of upFloat
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { step: '1', color: '#0891b2', bg: 'rgba(8,145,178,0.08)', icon: Users2, href: '/clients/new',
                title: 'Add your first client', desc: 'Add one client (e.g. Rajesh Traders). All tasks and compliance work will be linked to clients.', cta: 'Add client →' },
              { step: '2', color: '#0d9488', bg: 'rgba(13,148,136,0.08)', icon: FileCheck, href: '/compliance', highlight: true,
                title: 'Set up CA Compliance', desc: 'GST, ITR, TDS deadlines are pre-loaded for you. Assign them to your team in one click.', cta: 'Open Compliance →' },
              { step: '3', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', icon: CheckSquare, href: '/inbox',
                title: 'Create your first task', desc: 'Add any ad-hoc task — a client call, a document to review, anything that needs to be done.', cta: 'Create task →' },
              { step: '4', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', icon: Users2, href: '/team',
                title: 'Invite your team', desc: 'Invite your juniors, articleship staff, or co-CAs. Assign work and track in one place.', cta: 'Invite team →' },
            ].map(({ step, color, bg, icon: Icon, href, title, desc, cta, highlight }) => (
              <Link key={step} href={href} style={{
                textDecoration: 'none', borderRadius: 14, padding: '18px 16px',
                background: highlight ? 'rgba(13,148,136,0.12)' : bg,
                border: `1.5px solid ${highlight ? color : color + '30'}`,
                display: 'flex', flexDirection: 'column', gap: 10,
                transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${color}20` }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}>
                {highlight && (
                  <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700,
                    background: color, color: '#fff', padding: '2px 8px', borderRadius: 99, letterSpacing: '0.04em' }}>
                    START HERE
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 15, height: 15, color }}/>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{step}</span>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>{title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{desc}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color, marginTop: 'auto' }}>
                  {cta} <ChevRight style={{ width: 12, height: 12 }}/>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="dash-cols" style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 20 }}>

        {/* My tasks */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>My tasks</h2>
              {overdueCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#dc262615', color: '#dc2626',
                  padding: '2px 8px', borderRadius: 99 }}>{overdueCount} overdue</span>
              )}
            </div>
            <Link href="/tasks" style={{ display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 500 }}>
              View all <ArrowRight style={{ width: 12, height: 12 }}/>
            </Link>
          </div>
          <div className="card-elevated" style={{ overflow: 'hidden' }}>
            {myTasks && myTasks.length > 0 ? myTasks.map((task, i) => {
              const isOv   = task.due_date && task.due_date < today
              const isToday = task.due_date === today
              const proj   = task.projects as unknown as { id: string; name: string; color: string } | null
              const isLast = i === myTasks.length - 1
              return (
                <Link key={task.id} href="/tasks" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                  textDecoration: 'none', background: isOv ? 'rgba(220,38,38,0.02)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isOv ? 'rgba(220,38,38,0.02)' : 'transparent'}>
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
                    <span style={{ fontSize: 11, flexShrink: 0, fontWeight: isOv || isToday ? 600 : 400,
                      color: isOv ? '#dc2626' : isToday ? 'var(--brand)' : '#94a3b8',
                      background: isOv ? '#dc262610' : isToday ? 'rgba(13,148,136,0.1)' : 'transparent',
                      padding: isOv || isToday ? '2px 8px' : '2px 0', borderRadius: 99 }}>
                      {isOv ? '⚠ Overdue' : isToday ? '● Today' : fmtDate(task.due_date)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI brief — admins only */}
          {isAdmin && <AiBriefCard />}

          {/* Monthly progress card */}
          <div className="card-elevated" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity style={{ width: 15, height: 15, color: 'var(--brand)' }}/>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Monthly progress</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>last 30 days</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border-light)" strokeWidth="5"/>
                  <circle cx="32" cy="32" r="26" fill="none"
                    stroke={completionRate >= 70 ? '#16a34a' : 'var(--brand)'}
                    strokeWidth="5"
                    strokeDasharray={`${(completionRate / 100) * 163.4} 163.4`}
                    strokeLinecap="round"/>
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 13, fontWeight: 800,
                  color: completionRate >= 70 ? '#16a34a' : 'var(--brand)' }}>
                  {completionRate}%
                </span>
              </div>
              <div style={{ flex: 1 }}>
                {[
                  { label: 'Completed', value: completedThisMonth, color: '#16a34a' },
                  { label: 'Created', value: totalThisMonth, color: 'var(--text-primary)' },
                  { label: 'This week', value: weeklyCompleted, color: '#ea580c' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
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
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }}/>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Clients</h2>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-subtle)',
                    padding: '1px 7px', borderRadius: 99, border: '1px solid var(--border)' }}>{clientsCount}</span>
                </div>
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
