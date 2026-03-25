'use client'
import Link from 'next/link'
import { AlertCircle, Clock, CheckSquare, TrendingUp, ArrowRight, FolderOpen,
         CheckCircle2, Users2, BarChart2, Calendar, Zap, Star } from 'lucide-react'
import { fmtDate } from '@/lib/utils/format'

interface Props {
  greeting: string; name: string; today: string
  overdueCount: number; todayCount: number; pendingCount: number
  completedThisMonth: number; totalThisMonth: number; completionRate: number
  myTasks: { id:string; title:string; status:string; due_date:string|null; project_id:string|null; projects: any }[]
  activeProjects: { id:string; name:string; color:string; due_date:string|null; clients: any }[]
  recentClients: { id:string; name:string; color:string }[]
}

export function DashboardClient({
  greeting, name, today,
  overdueCount, todayCount, pendingCount,
  completedThisMonth, totalThisMonth, completionRate,
  myTasks, activeProjects, recentClients,
}: Props) {

  const quickLinks = [
    { icon: CheckSquare, label: 'New task',    href: '/inbox',      color: '#0d9488', bg: '#f0fdfa' },
    { icon: FolderOpen,  label: 'New project', href: '/projects/new', color: '#7c3aed', bg: '#f5f3ff' },
    { icon: Users2,      label: 'Clients',     href: '/clients',    color: '#0891b2', bg: '#ecfeff' },
    { icon: BarChart2,   label: 'Reports',     href: '/reports',    color: '#ca8a04', bg: '#fffbeb' },
  ]

  return (
    <div className="page-container">

      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #0891b2 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position:'absolute', right:-40, top:-40, width:200, height:200,
          borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ position:'absolute', right:60, bottom:-60, width:160, height:160,
          borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>

        <div style={{ position:'relative', zIndex:1 }}>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', marginBottom:4 }}>{greeting} 👋</p>
          <h1 style={{ fontSize:26, fontWeight:800, color:'#fff', lineHeight:1.2, marginBottom:6 }}>
            {name}, welcome back!
          </h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.8)' }}>
            {overdueCount > 0
              ? `You have ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} that need attention.`
              : todayCount > 0
              ? `You have ${todayCount} task${todayCount > 1 ? 's' : ''} due today — let's get them done!`
              : 'You\'re all caught up! Great work 🎉'}
          </p>
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <Link href="/inbox" style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'8px 16px', borderRadius:8, background:'#fff', color:'#0d9488',
              fontSize:13, fontWeight:600, textDecoration:'none', transition:'all 0.15s',
            }}>
              <Zap style={{ width:14, height:14 }}/> Add task
            </Link>
            <Link href="/reports" style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'8px 16px', borderRadius:8, background:'rgba(255,255,255,0.15)',
              color:'#fff', fontSize:13, fontWeight:500, textDecoration:'none',
            }}>
              View reports
            </Link>
          </div>
        </div>

        {/* Mini app preview mockup */}
        <div style={{
          position:'relative', zIndex:1, flexShrink:0,
          display:'flex', gap:10,
        }} className="hidden lg:flex">
          {/* Mini task card 1 */}
          <div style={{ width:160, background:'#fff', borderRadius:10, padding:'10px 12px',
            boxShadow:'0 4px 16px rgba(0,0,0,0.15)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <div style={{ width:8,height:8,borderRadius:'50%',background:'#0d9488' }}/>
              <span style={{ fontSize:11, fontWeight:600, color:'#0f172a' }}>Website Redesign</span>
            </div>
            {['Homepage copy','SEO audit','Brand refresh'].map((t,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                <div style={{ width:12,height:12,borderRadius:'50%',
                  background: i===0?'#0d9488':'transparent',
                  border: i===0?'none':'1.5px solid #cbd5e1',
                  flexShrink:0 }}/>
                <span style={{ fontSize:10, color: i===0?'#94a3b8':'#374151',
                  textDecoration: i===0?'line-through':'none' }}>{t}</span>
              </div>
            ))}
            <div style={{ marginTop:8, height:3, background:'#e2e8f0', borderRadius:99 }}>
              <div style={{ width:'33%', height:'100%', background:'#0d9488', borderRadius:99 }}/>
            </div>
          </div>
          {/* Mini task card 2 */}
          <div style={{ width:148, background:'#fff', borderRadius:10, padding:'10px 12px',
            boxShadow:'0 4px 16px rgba(0,0,0,0.15)', marginTop:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <div style={{ width:8,height:8,borderRadius:'50%',background:'#7c3aed' }}/>
              <span style={{ fontSize:11, fontWeight:600, color:'#0f172a' }}>Client Onboarding</span>
            </div>
            {['Intro call','Send contract','Setup account'].map((t,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                <div style={{ width:12,height:12,borderRadius:'50%',
                  background: i<2?'#7c3aed':'transparent',
                  border: i<2?'none':'1.5px solid #cbd5e1', flexShrink:0 }}/>
                <span style={{ fontSize:10, color: i<2?'#94a3b8':'#374151',
                  textDecoration: i<2?'line-through':'none' }}>{t}</span>
              </div>
            ))}
            <div style={{ marginTop:8, height:3, background:'#e2e8f0', borderRadius:99 }}>
              <div style={{ width:'66%', height:'100%', background:'#7c3aed', borderRadius:99 }}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { n:overdueCount??0,  label:'Overdue',          href:'/tasks',  color:'#dc2626', bg:'#fef2f2', border:'#fecaca', icon:AlertCircle },
          { n:todayCount??0,    label:'Due today',         href:'/tasks',  color:'#0d9488', bg:'#f0fdfa', border:'#99f6e4', icon:Clock       },
          { n:pendingCount??0,  label:'Awaiting approval', href:'/tasks',  color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', icon:CheckCircle2 },
          { n:completedThisMonth??0, label:'Done this month', href:'/reports', color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', icon:Star },
        ].map(({ n, label, href, color, bg, border, icon:Icon }) => (
          <Link key={label} href={href} style={{
            display:'block', textDecoration:'none',
            background: n>0 ? bg : 'var(--surface)',
            border:`1px solid ${n>0 ? border : 'var(--border)'}`,
            borderRadius:12, padding:'16px 18px', transition:'all 0.15s',
          }}
          onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-2px)';(e.currentTarget as any).style.boxShadow='0 6px 20px rgba(0,0,0,0.08)'}}
          onMouseLeave={e=>{(e.currentTarget as any).style.transform='';(e.currentTarget as any).style.boxShadow=''}}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
                background: n>0?border:'var(--border-light)' }}>
                <Icon style={{ width:15, height:15, color: n>0?color:'#94a3b8' }}/>
              </div>
              <span style={{ fontSize:12, fontWeight:500, color: n>0?color:'var(--text-muted)' }}>{label}</span>
            </div>
            <p style={{ fontSize:30, fontWeight:800, lineHeight:1, color: n>0?color:'#cbd5e1' }}>{n}</p>
          </Link>
        ))}
      </div>

      {/* ── Quick links ──────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
        {quickLinks.map(({ icon:Icon, label, href, color, bg }) => (
          <Link key={href} href={href} style={{
            display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:10, textDecoration:'none', transition:'all 0.15s',
          }}
          onMouseEnter={e=>{(e.currentTarget as any).style.borderColor=color;(e.currentTarget as any).style.background=bg}}
          onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='var(--border)';(e.currentTarget as any).style.background='var(--surface)'}}>
            <div style={{ width:32, height:32, borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon style={{ width:15, height:15, color }}/>
            </div>
            <span style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Main content grid ────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:20 }}>

        {/* My tasks */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <h2 style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>My tasks</h2>
            <Link href="/tasks" style={{ fontSize:12, color:'var(--brand)', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
              View all <ArrowRight style={{ width:12, height:12 }}/>
            </Link>
          </div>
          <div className="card-elevated" style={{ overflow:'hidden' }}>
            {myTasks && myTasks.length > 0 ? myTasks.map(task => {
              const isOv = task.due_date && task.due_date < today
              const proj = task.projects as unknown as { id:string; name:string; color:string } | null
              return (
                <Link key={task.id} href="/tasks" style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 16px', borderBottom:'1px solid var(--border-light)',
                  textDecoration:'none', transition:'background 0.1s',
                }}
                onMouseEnter={e=>(e.currentTarget as any).style.background='var(--surface-subtle)'}
                onMouseLeave={e=>(e.currentTarget as any).style.background='transparent'}>
                  <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background: isOv?'#dc2626':'var(--brand)' }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, color:'var(--text-primary)', overflow:'hidden',
                      whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{task.title}</p>
                    {proj && (
                      <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:2,
                        display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:6,height:6,borderRadius:2,background:proj.color,display:'inline-block' }}/>
                        {proj.name}
                      </p>
                    )}
                  </div>
                  {task.due_date && (
                    <span style={{ fontSize:11, flexShrink:0, color: isOv?'#dc2626':'#94a3b8',
                      fontWeight: isOv?600:400 }}>
                      {fmtDate(task.due_date)}
                    </span>
                  )}
                </Link>
              )
            }) : (
              <div style={{ padding:'32px 16px', textAlign:'center' }}>
                <CheckCircle2 style={{ width:32, height:32, color:'#e2e8f0', margin:'0 auto 8px' }}/>
                <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:6 }}>No tasks assigned to you</p>
                <Link href="/inbox" style={{ fontSize:12, color:'var(--brand)', textDecoration:'none' }}>Create a task →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Active projects */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h2 style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Active projects</h2>
              <Link href="/projects" style={{ fontSize:12, color:'var(--brand)', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                View all <ArrowRight style={{ width:12, height:12 }}/>
              </Link>
            </div>
            <div className="card-elevated" style={{ overflow:'hidden' }}>
              {activeProjects && activeProjects.length > 0 ? activeProjects.map(p => {
                const client = p.clients as unknown as { id:string; name:string; color:string } | null
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px', borderBottom:'1px solid var(--border-light)',
                    textDecoration:'none', transition:'background 0.1s',
                  }}
                  onMouseEnter={e=>(e.currentTarget as any).style.background='var(--surface-subtle)'}
                  onMouseLeave={e=>(e.currentTarget as any).style.background='transparent'}>
                    <div style={{ width:30,height:30,borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:p.color+'20' }}>
                      <FolderOpen style={{ width:14, height:14, color:p.color }}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{p.name}</p>
                      {client && (
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                          <div style={{ width:6,height:6,borderRadius:2,background:client.color }}/>
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{client.name}</span>
                        </div>
                      )}
                    </div>
                    {p.due_date && <span style={{ fontSize:11, color:'#94a3b8', flexShrink:0 }}>{fmtDate(p.due_date)}</span>}
                  </Link>
                )
              }) : (
                <div style={{ padding:'24px 16px', textAlign:'center' }}>
                  <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:4 }}>No active projects</p>
                  <Link href="/projects/new" style={{ fontSize:12, color:'var(--brand)', textDecoration:'none' }}>Create project →</Link>
                </div>
              )}
            </div>
          </div>

          {/* 30-day stats */}
          <div className="card-elevated" style={{ padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <TrendingUp style={{ width:15, height:15, color:'var(--brand)' }}/>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Last 30 days</span>
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                <span style={{ color:'var(--text-muted)' }}>Completion rate</span>
                <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{completionRate}%</span>
              </div>
              <div style={{ height:6, borderRadius:99, overflow:'hidden', background:'var(--border-light)', marginBottom:12 }}>
                <div style={{ height:'100%', borderRadius:99, background: completionRate>=70?'#16a34a':'var(--brand)', width:`${completionRate}%`, transition:'width 0.7s' }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                <span style={{ color:'var(--text-muted)' }}>Completed</span>
                <span style={{ fontWeight:600, color:'#16a34a' }}>{completedThisMonth??0}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span style={{ color:'var(--text-muted)' }}>Total created</span>
                <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{totalThisMonth??0}</span>
              </div>
            </div>
          </div>

          {/* Recent clients */}
          {recentClients && recentClients.length > 0 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <h2 style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>Clients</h2>
                <Link href="/clients" style={{ fontSize:12, color:'var(--brand)', textDecoration:'none' }}>View all</Link>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {recentClients.map(c => (
                  <Link key={c.id} href={`/clients/${c.id}`} style={{
                    display:'flex', alignItems:'center', gap:6,
                    padding:'6px 12px', borderRadius:8,
                    background:'var(--surface)', border:'1px solid var(--border)',
                    fontSize:12, fontWeight:500, color:'var(--text-primary)', textDecoration:'none',
                    transition:'all 0.12s',
                  }}
                  onMouseEnter={e=>{(e.currentTarget as any).style.borderColor=c.color;(e.currentTarget as any).style.background=c.color+'12'}}
                  onMouseLeave={e=>{(e.currentTarget as any).style.borderColor='var(--border)';(e.currentTarget as any).style.background='var(--surface)'}}>
                    <div style={{ width:8,height:8,borderRadius:2,background:c.color,flexShrink:0 }}/>
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
