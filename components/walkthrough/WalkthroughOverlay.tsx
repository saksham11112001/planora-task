'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter }    from 'next/navigation'
import { X, ChevronRight, ChevronLeft, ArrowRight, CheckCircle2 } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Slide illustrations — SVG/HTML mini-mockups of each feature
// ─────────────────────────────────────────────────────────────────────────────

function IllustrationWelcome() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Background grid */}
      {[0,1,2,3,4].map(i => (
        <line key={`h${i}`} x1="0" y1={30+i*52} x2="320" y2={30+i*52} stroke="#e2e8f0" strokeWidth="1"/>
      ))}
      {[0,1,2,3,4,5].map(i => (
        <line key={`v${i}`} x1={20+i*54} y1="0" x2={20+i*54} y2="260" stroke="#e2e8f0" strokeWidth="1"/>
      ))}
      {/* Central logo circle */}
      <circle cx="160" cy="120" r="58" fill="#0d9488" fillOpacity="0.1" stroke="#0d9488" strokeWidth="1.5"/>
      <circle cx="160" cy="120" r="42" fill="#0d9488" fillOpacity="0.15"/>
      <circle cx="160" cy="120" r="28" fill="#0d9488"/>
      {/* Checkmark */}
      <path d="M148 120 L157 130 L174 112" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Orbiting modules */}
      {[
        { angle: -45, color:'#7c3aed', label:'CA', r:78 },
        { angle: 45,  color:'#0891b2', label:'Tasks', r:78 },
        { angle: 135, color:'#d97706', label:'Clients', r:78 },
        { angle: 225, color:'#16a34a', label:'Reports', r:78 },
      ].map(({ angle, color, label, r }, i) => {
        const rad = (angle * Math.PI) / 180
        const cx  = 160 + r * Math.cos(rad)
        const cy  = 120 + r * Math.sin(rad)
        return (
          <g key={i}>
            <line x1="160" y1="120" x2={cx} y2={cy} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
            <circle cx={cx} cy={cy} r="20" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5"/>
            <text x={cx} y={cy+4} textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>{label}</text>
          </g>
        )
      })}
      {/* Bottom stats */}
      {[
        { x:50,  val:'69+', label:'Tasks', color:'#0d9488' },
        { x:160, val:'∞',   label:'Clients', color:'#7c3aed' },
        { x:270, val:'100%', label:'Compliance', color:'#d97706' },
      ].map(({ x, val, label, color }) => (
        <g key={label}>
          <rect x={x-30} y="222" width="60" height="32" rx="8" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1" strokeOpacity="0.3"/>
          <text x={x} y="239" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{val}</text>
          <text x={x} y="249" textAnchor="middle" fontSize="7" fontWeight="600" fill={color} fillOpacity="0.7">{label}</text>
        </g>
      ))}
    </svg>
  )
}

function IllustrationTeam() {
  const members = [
    { name:'Rahul G', role:'Owner', color:'#0d9488', y:55 },
    { name:'Priya S', role:'Manager', color:'#7c3aed', y:120 },
    { name:'Amit K', role:'Member', color:'#0891b2', y:185 },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="20" y="20" width="280" height="220" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="20" y="20" width="280" height="32" rx="12" fill="#0d9488" fillOpacity="0.08"/>
      <text x="36" y="40" fontSize="10" fontWeight="700" fill="#0d9488">Team Members</text>
      <rect x="240" y="27" width="48" height="18" rx="5" fill="#0d9488"/>
      <text x="264" y="38.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">+ Invite</text>
      {members.map(m => (
        <g key={m.name}>
          <rect x="32" y={m.y} width="256" height="44" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <circle cx="56" cy={m.y+22} r="14" fill={m.color} fillOpacity="0.15"/>
          <text x="56" y={m.y+26} textAnchor="middle" fontSize="10" fontWeight="700" fill={m.color}>{m.name[0]}</text>
          <text x="78" y={m.y+17} fontSize="11" fontWeight="600" fill="#1e293b">{m.name}</text>
          <text x="78" y={m.y+30} fontSize="9" fill="#94a3b8">{m.role}</text>
          <rect x="240" y={m.y+12} width="36" height="18" rx="5" fill={m.color} fillOpacity="0.12" stroke={m.color} strokeWidth="1" strokeOpacity="0.4"/>
          <text x="258" y={m.y+24} textAnchor="middle" fontSize="8" fontWeight="700" fill={m.color}>{m.role === 'Owner' ? 'Owner' : m.role === 'Manager' ? 'Mgr' : 'Mem'}</text>
        </g>
      ))}
    </svg>
  )
}

function IllustrationClients() {
  const clients = [
    { name:'Shanti Chemicals', gstin:'27AABC...', dsc:'15 Jun', color:'#0891b2' },
    { name:'Mehta & Sons LLP', gstin:'06XXYZ...', dsc:'3 days', color:'#dc2626' },
    { name:'Sunrise Exports', gstin:'29PQRS...', dsc:'45 days', color:'#16a34a' },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="20" y="20" width="280" height="220" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="20" y="20" width="280" height="32" rx="12" fill="#0891b2" fillOpacity="0.08"/>
      <text x="36" y="40" fontSize="10" fontWeight="700" fill="#0891b2">Clients</text>
      <rect x="32" y="60" width="135" height="22" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <text x="44" y="75" fontSize="9" fill="#94a3b8">🔍 Search clients…</text>
      <rect x="175" y="60" width="113" height="22" rx="6" fill="#0891b2"/>
      <text x="231" y="75" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">+ Add Client</text>
      {clients.map((c, i) => (
        <g key={c.name}>
          <rect x="32" y={92+i*52} width="256" height="44" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <rect x="32" y={92+i*52} width="4" height="44" rx="2" fill={c.color}/>
          <circle cx="56" cy={92+i*52+22} r="10" fill={c.color} fillOpacity="0.15"/>
          <text x="56" y={92+i*52+26} textAnchor="middle" fontSize="8" fontWeight="800" fill={c.color}>{c.name[0]}</text>
          <text x="74" y={92+i*52+17} fontSize="10" fontWeight="600" fill="#1e293b">{c.name}</text>
          <text x="74" y={92+i*52+30} fontSize="8" fill="#94a3b8">GSTIN: {c.gstin}</text>
          <rect x="230" y={92+i*52+11} width="46" height="18" rx="5"
            fill={c.dsc === '3 days' ? '#fee2e2' : c.dsc === '15 Jun' ? '#fef3c7' : '#dcfce7'}
            stroke={c.color} strokeWidth="0.8" strokeOpacity="0.5"/>
          <text x="253" y={92+i*52+23} textAnchor="middle" fontSize="7.5" fontWeight="700"
            fill={c.color}>DSC {c.dsc}</text>
        </g>
      ))}
    </svg>
  )
}

function IllustrationCompliance() {
  const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
  const tasks  = [
    { name:'GSTR 3B', color:'#0891b2', months:[0,1,2,3,4,5,6,7,8,9,10,11] },
    { name:'ITR Filing', color:'#7c3aed', months:[3,4] },
    { name:'TDS Return', color:'#d97706', months:[0,3,6,9] },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="10" y="10" width="300" height="240" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="10" y="10" width="300" height="30" rx="10" fill="#d97706" fillOpacity="0.1"/>
      <text x="22" y="29" fontSize="10" fontWeight="700" fill="#b45309">CA Compliance Calendar — FY 2025-26</text>
      {/* Month headers */}
      {months.map((m, i) => (
        <text key={m} x={22+i*23.5} y="55" fontSize="6.5" fontWeight="700" fill="#94a3b8">{m}</text>
      ))}
      {/* Task rows */}
      {tasks.map((t, ti) => (
        <g key={t.name}>
          <text x="14" y={72+ti*42} fontSize="7.5" fontWeight="600" fill="#475569">{t.name}</text>
          {months.map((_, mi) => {
            const hasTask = t.months.includes(mi)
            return (
              <rect key={mi} x={18+mi*23.5} y={62+ti*42} width="18" height="18" rx="4"
                fill={hasTask ? t.color : '#f1f5f9'}
                fillOpacity={hasTask ? 0.2 : 1}
                stroke={hasTask ? t.color : '#e2e8f0'}
                strokeWidth={hasTask ? 1.5 : 0.8}
              />
            )
          })}
          {months.map((_, mi) => {
            const hasTask = t.months.includes(mi)
            return hasTask ? (
              <text key={mi} x={27+mi*23.5} y={75+ti*42} textAnchor="middle" fontSize="6" fontWeight="700" fill={t.color}>✓</text>
            ) : null
          })}
        </g>
      ))}
      {/* Footer */}
      <rect x="10" y="214" width="300" height="36" rx="0" fill="#fef3c7"/>
      <rect x="10" y="214" width="300" height="36" rx="0" ry="0"/>
      <path d="M10 214 L310 214 L310 240 Q310 250 300 250 L20 250 Q10 250 10 240 Z" fill="#fef3c7"/>
      <text x="20" y="228" fontSize="8" fontWeight="700" fill="#b45309">⏰  3 tasks triggering in next 7 days</text>
      <text x="20" y="242" fontSize="7.5" fill="#b45309" fillOpacity="0.8">GSTR 3B · TDS Q1 · ESI Return</text>
    </svg>
  )
}

function IllustrationKanban() {
  const cols = [
    { label:'Overdue', color:'#dc2626', tasks:['GSTR 9C Audit','Form 16 Issue'] },
    { label:'To Do',   color:'#64748b', tasks:['ITR Filing','ROC Annual'] },
    { label:'In Review', color:'#7c3aed', tasks:['TDS Return Q1'] },
    { label:'Done',    color:'#16a34a', tasks:['GSTR 3B May'] },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {cols.map((col, ci) => {
        const x = 10 + ci * 76
        return (
          <g key={col.label}>
            {/* Column header */}
            <rect x={x} y="10" width="70" height="22" rx="6" fill={col.color} fillOpacity="0.12" stroke={col.color} strokeWidth="1" strokeOpacity="0.4"/>
            <circle cx={x+10} cy="21" r="4" fill={col.color}/>
            <text x={x+18} y="25" fontSize="7.5" fontWeight="700" fill={col.color}>{col.label}</text>
            {/* Task cards */}
            {col.tasks.map((t, ti) => (
              <g key={t}>
                <rect x={x} y={40+ti*54} width="70" height="46" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
                <rect x={x} y={40+ti*54} width="3" height="46" rx="1.5" fill={col.color}/>
                <text x={x+8} y={57+ti*54} fontSize="7" fontWeight="600" fill="#1e293b"
                  style={{ overflow:'hidden' }}>{t.length>12 ? t.slice(0,12)+'…' : t}</text>
                <rect x={x+6} y={66+ti*54} width="20" height="10" rx="3" fill={col.color} fillOpacity="0.12"/>
                <text x={x+16} y={74+ti*54} textAnchor="middle" fontSize="6" fontWeight="600" fill={col.color}>High</text>
                <circle cx={x+56} cy={71+ti*54} r="8" fill={col.color} fillOpacity="0.15"/>
                <text x={x+56} y={74+ti*54} textAnchor="middle" fontSize="7" fontWeight="700" fill={col.color}>R</text>
              </g>
            ))}
          </g>
        )
      })}
      {/* Drag hint */}
      <rect x="86" y="195" width="70" height="46" rx="6" fill="white" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 2"/>
      <text x="121" y="222" textAnchor="middle" fontSize="7" fill="#7c3aed">Drag here…</text>
    </svg>
  )
}

function IllustrationApproval() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Flow diagram */}
      {/* Step 1 — Assignee completes */}
      <rect x="30" y="40" width="100" height="50" rx="10" fill="#0891b2" fillOpacity="0.1" stroke="#0891b2" strokeWidth="1.5"/>
      <circle cx="55" cy="65" r="14" fill="#0891b2" fillOpacity="0.2"/>
      <text x="55" y="69" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0891b2">A</text>
      <text x="79" y="59" fontSize="9" fontWeight="600" fill="#1e293b">Work Done</text>
      <text x="79" y="73" fontSize="8" fill="#64748b">Assignee marks</text>
      <text x="79" y="84" fontSize="8" fill="#64748b">task complete</text>
      {/* Arrow */}
      <path d="M130 65 L160 65" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2"/>
      <polygon points="160,60 170,65 160,70" fill="#94a3b8"/>
      {/* Step 2 — In Review */}
      <rect x="170" y="40" width="120" height="50" rx="10" fill="#7c3aed" fillOpacity="0.1" stroke="#7c3aed" strokeWidth="1.5"/>
      <circle cx="192" cy="65" r="14" fill="#7c3aed" fillOpacity="0.2"/>
      <text x="192" y="69" textAnchor="middle" fontSize="7" fill="#7c3aed">⏳</text>
      <text x="212" y="59" fontSize="9" fontWeight="600" fill="#1e293b">Pending Review</text>
      <text x="212" y="73" fontSize="8" fill="#64748b">Manager gets</text>
      <text x="212" y="84" fontSize="8" fill="#64748b">notification</text>
      {/* Down arrow */}
      <path d="M230 90 L230 118" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2"/>
      <polygon points="225,118 230,128 235,118" fill="#94a3b8"/>
      {/* Approve path */}
      <rect x="170" y="128" width="120" height="44" rx="10" fill="#16a34a" fillOpacity="0.1" stroke="#16a34a" strokeWidth="1.5"/>
      <text x="230" y="150" textAnchor="middle" fontSize="9" fontWeight="600" fill="#15803d">✓ Approved</text>
      <text x="230" y="163" textAnchor="middle" fontSize="8" fill="#64748b">Task closed</text>
      {/* Reject path */}
      <path d="M170 150 L140 150" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2"/>
      <polygon points="140,145 130,150 140,155" fill="#94a3b8"/>
      <rect x="30" y="128" width="100" height="44" rx="10" fill="#dc2626" fillOpacity="0.1" stroke="#dc2626" strokeWidth="1.5"/>
      <text x="80" y="150" textAnchor="middle" fontSize="9" fontWeight="600" fill="#dc2626">✕ Returned</text>
      <text x="80" y="163" textAnchor="middle" fontSize="8" fill="#64748b">Back to assignee</text>
      {/* Labels */}
      <text x="145" y="146" fontSize="7" fill="#16a34a" fontWeight="700">Approve</text>
      <text x="138" y="158" fontSize="7" fill="#dc2626" fontWeight="700">Return</text>
      {/* Audit trail */}
      <rect x="30" y="195" width="260" height="36" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1"/>
      <text x="44" y="210" fontSize="8.5" fontWeight="700" fill="#475569">📋  Full audit trail maintained</text>
      <text x="44" y="224" fontSize="8" fill="#94a3b8">Every action timestamped · Email & SMS notifications sent</text>
    </svg>
  )
}

function IllustrationCalendar() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1)
  const deadlines: Record<number, string> = { 7:'#dc2626', 11:'#d97706', 15:'#0891b2', 20:'#7c3aed', 25:'#0d9488', 28:'#dc2626' }
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="15" y="10" width="290" height="240" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* Header */}
      <rect x="15" y="10" width="290" height="36" rx="12" fill="#0d9488" fillOpacity="0.1"/>
      <text x="30" y="32" fontSize="11" fontWeight="700" fill="#0d9488">May 2026</text>
      <text x="260" y="32" textAnchor="middle" fontSize="9" fill="#0d9488">◀  ▶</text>
      {/* Day headers */}
      {['S','M','T','W','T','F','S'].map((d, i) => (
        <text key={i} x={30+i*39} y="60" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8">{d}</text>
      ))}
      {/* Day cells — simplified 5×6 grid starting Monday */}
      {days.slice(0,28).map((day, i) => {
        const col = (i + 2) % 7  // shift start to Thursday (Apr ~)
        const row = Math.floor((i + 2) / 7)
        const x   = 30 + col * 39
        const y   = 72 + row * 34
        const color = deadlines[day]
        return (
          <g key={day}>
            {color && <circle cx={x} cy={y+8} r="13" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5"/>}
            <text x={x} y={y+12} textAnchor="middle" fontSize="10"
              fontWeight={color ? '700' : '400'} fill={color ?? '#475569'}>{day}</text>
            {color && <circle cx={x+9} cy={y-1} r="3.5" fill={color}/>}
          </g>
        )
      })}
      {/* Legend */}
      <rect x="15" y="228" width="290" height="22" rx="0"/>
      <path d="M15 228 L305 228 L305 240 Q305 250 295 250 L35 250 Q15 250 15 240 Z" fill="#fef3c7"/>
      <text x="25" y="242" fontSize="7.5" fontWeight="700" fill="#b45309">● GST  ● TDS  ● ITR  ● ROC  ● PF/ESI  ● Other</text>
    </svg>
  )
}

function IllustrationMyTasks() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="15" y="10" width="290" height="240" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* Stats strip */}
      {[
        { x:15,   label:'Overdue', val:'3', color:'#dc2626' },
        { x:88,   label:'Today',   val:'2', color:'#0d9488' },
        { x:161,  label:'Pending', val:'5', color:'#7c3aed' },
        { x:234,  label:'Done',    val:'12', color:'#16a34a' },
      ].map(s => (
        <g key={s.label}>
          <rect x={s.x} y="10" width="72" height="42" rx="0"
            fill={s.color} fillOpacity="0.07"
            stroke={s.color} strokeWidth="0" strokeOpacity="0.2"/>
          <text x={s.x+36} y="34" textAnchor="middle" fontSize="16" fontWeight="800" fill={s.color}>{s.val}</text>
          <text x={s.x+36} y="45" textAnchor="middle" fontSize="7" fontWeight="600" fill={s.color} fillOpacity="0.8">{s.label}</text>
        </g>
      ))}
      {/* Section tabs */}
      <rect x="15" y="52" width="290" height="26" rx="0" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      {[
        { label:'My Tasks', x:35, active:true },
        { label:'Needs Approval', x:110, active:false, badge:'5' },
        { label:'Assigned by Me', x:210, active:false },
      ].map(t => (
        <g key={t.label}>
          <text x={t.x} y="68" fontSize="8.5" fontWeight={t.active ? '700' : '500'} fill={t.active ? '#0d9488' : '#94a3b8'}>{t.label}</text>
          {t.active && <rect x={t.x-2} y="76" width={t.label.length*5+4} height="2" rx="1" fill="#0d9488"/>}
          {t.badge && <rect x={t.x+t.label.length*5+4} y="60" width="13" height="12" rx="6" fill="#7c3aed"/>}
          {t.badge && <text x={t.x+t.label.length*5+10} y="70" textAnchor="middle" fontSize="7" fontWeight="700" fill="white">{t.badge}</text>}
        </g>
      ))}
      {/* Task rows */}
      {[
        { title:'GSTR 3B — Mehta & Sons', due:'Today', color:'#dc2626', priority:'Urgent', section:'Overdue' },
        { title:'TDS Return Q1',           due:'May 7', color:'#d97706', priority:'High',   section:'Today' },
        { title:'PF Challan — Sunrise',    due:'May 11',color:'#0891b2', priority:'Medium', section:'This Week' },
        { title:'ITR Filing — R. Gupta',   due:'May 31',color:'#7c3aed', priority:'High',   section:'Later' },
      ].map((t, i) => (
        <g key={t.title}>
          {i === 0 && <text x="22" y="94" fontSize="7" fontWeight="800" fill="#dc2626" style={{textTransform:'uppercase'}}>▾ OVERDUE (1)</text>}
          {i === 1 && <text x="22" y="126" fontSize="7" fontWeight="800" fill="#0d9488" style={{textTransform:'uppercase'}}>▾ TODAY (1)</text>}
          {i === 2 && <text x="22" y="158" fontSize="7" fontWeight="800" fill="#475569" style={{textTransform:'uppercase'}}>▾ THIS WEEK (1)</text>}
          {i === 3 && <text x="22" y="190" fontSize="7" fontWeight="800" fill="#94a3b8" style={{textTransform:'uppercase'}}>▾ LATER (1)</text>}
          <rect x="22" y={97+i*32} width="271" height="24" rx="4" fill="white" stroke="#f1f5f9" strokeWidth="1"/>
          <rect x="22" y={97+i*32} width="3" height="24" rx="1.5" fill={t.color}/>
          <circle cx="37" cy={109+i*32} r="6" fill="transparent" stroke={t.color} strokeWidth="1.5"/>
          <text x="47" y={112+i*32} fontSize="8.5" fontWeight="500" fill="#1e293b">{t.title.length > 28 ? t.title.slice(0,28)+'…' : t.title}</text>
          <text x="253" y={112+i*32} textAnchor="end" fontSize="7.5" fontWeight="600"
            fill={t.due === 'Today' ? '#dc2626' : '#94a3b8'}>{t.due}</text>
        </g>
      ))}
    </svg>
  )
}

function IllustrationDone() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Confetti dots */}
      {[
        [50,30,'#0d9488'],[90,20,'#7c3aed'],[140,40,'#d97706'],[200,25,'#0891b2'],[250,35,'#16a34a'],[280,50,'#ec4899'],
        [30,80,'#d97706'],[270,70,'#0d9488'],[160,15,'#dc2626'],[60,110,'#7c3aed'],[290,100,'#0891b2'],
      ].map(([x,y,c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={i%3===0?5:3.5} fill={c as string} fillOpacity="0.7"/>
      ))}
      {[
        [80,45,'#0d9488'],[190,55,'#7c3aed'],[230,30,'#d97706'],[120,22,'#0891b2'],
      ].map(([x,y,c], i) => (
        <rect key={i} x={(x as number)-3} y={(y as number)-3} width="6" height="6" rx="1" fill={c as string} fillOpacity="0.6" transform={`rotate(${i*25})`}/>
      ))}
      {/* Central circle */}
      <circle cx="160" cy="130" r="70" fill="#16a34a" fillOpacity="0.08"/>
      <circle cx="160" cy="130" r="52" fill="#16a34a" fillOpacity="0.12"/>
      <circle cx="160" cy="130" r="36" fill="#16a34a"/>
      <path d="M142 130 L155 144 L180 116" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Text */}
      <text x="160" y="218" textAnchor="middle" fontSize="16" fontWeight="800" fill="#15803d">You're all set!</text>
      <text x="160" y="236" textAnchor="middle" fontSize="10" fill="#64748b">Start by adding your first client</text>
      {/* Arrow pointing to client button */}
      <path d="M195 242 Q220 248 240 238" stroke="#0d9488" strokeWidth="1.5" fill="none" strokeDasharray="3 2"/>
      <polygon points="238,233 244,240 235,242" fill="#0d9488"/>
    </svg>
  )
}

function IllustrationClientGroups() {
  const groups = [
    { label:'Manufacturing', count:6, color:'#0891b2', clients:['Shanti Chemicals','Sunrise Exports','Mehta & Sons'] },
    { label:'Service & Trade', count:4, color:'#7c3aed', clients:['R K Traders','Vista Pvt Ltd'] },
    { label:'Individual ITR', count:12, color:'#d97706', clients:['Ramesh Gupta','Priya Shah'] },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="15" y="10" width="290" height="240" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* header */}
      <rect x="15" y="10" width="290" height="32" rx="12" fill="#0891b2" fillOpacity="0.08"/>
      <text x="30" y="30" fontSize="10" fontWeight="700" fill="#0891b2">Clients</text>
      <rect x="220" y="17" width="74" height="18" rx="5" fill="#0891b2"/>
      <text x="257" y="29" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white">+ New Group</text>
      {/* groups */}
      {groups.map((g, gi) => (
        <g key={g.label}>
          {/* group row */}
          <rect x="22" y={48+gi*68} width="276" height="24" rx="6" fill={g.color} fillOpacity="0.07" stroke={g.color} strokeWidth="1" strokeOpacity="0.3"/>
          <text x="34" y={63+gi*68} fontSize="9" fontWeight="700" fill={g.color}>▾  📁  {g.label}</text>
          <rect x="254" y={53+gi*68} width="34" height="15" rx="4" fill={g.color} fillOpacity="0.15"/>
          <text x="271" y={64+gi*68} textAnchor="middle" fontSize="8" fontWeight="700" fill={g.color}>{g.count} clients</text>
          {/* client rows */}
          {g.clients.map((c, ci) => (
            <g key={c}>
              <line x1="38" y1={72+gi*68+ci*15+7} x2="42" y2={72+gi*68+ci*15+7} stroke={g.color} strokeWidth="1" strokeOpacity="0.4"/>
              <rect x="42" y={72+gi*68+ci*15} width="230" height="13" rx="3" fill="white" stroke="#f1f5f9" strokeWidth="0.8"/>
              <circle cx="51" cy={72+gi*68+ci*15+6} r="4" fill={g.color} fillOpacity="0.2"/>
              <text x="59" y={72+gi*68+ci*15+10} fontSize="7.5" fill="#334155">{c}</text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}

function IllustrationCAAdvanced() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Task card */}
      <rect x="15" y="10" width="290" height="240" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="15" y="10" width="290" height="32" rx="12" fill="#b45309" fillOpacity="0.08"/>
      <text x="30" y="30" fontSize="9.5" fontWeight="700" fill="#b45309">GSTR 3B — Mehta &amp; Sons · May 2026</text>

      {/* NIL return section */}
      <rect x="22" y="50" width="133" height="44" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <rect x="30" y="58" width="12" height="12" rx="3" fill="#0d9488" stroke="#0d9488" strokeWidth="1"/>
      <path d="M33 64 L36 68 L41 60" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="48" y="66" fontSize="8.5" fontWeight="700" fill="#0d9488">Mark as NIL Return</text>
      <text x="30" y="83" fontSize="7.5" fill="#64748b">No transactions this period</text>

      {/* GDrive section */}
      <rect x="163" y="50" width="130" height="44" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <rect x="170" y="58" width="14" height="14" rx="3" fill="#4285f4" fillOpacity="0.15" stroke="#4285f4" strokeWidth="0.8"/>
      <text x="170" y="65" fontSize="8" fill="#4285f4">📎</text>
      <text x="190" y="66" fontSize="8.5" fontWeight="700" fill="#1e293b">Google Drive</text>
      <text x="170" y="82" fontSize="7.5" fill="#64748b">Paste Drive link to attach</text>

      {/* Attachment headers */}
      <rect x="22" y="103" width="271" height="22" rx="5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1"/>
      <text x="30" y="117" fontSize="7.5" fontWeight="700" fill="#475569">Acknowledgement</text>
      <text x="110" y="117" fontSize="7.5" fontWeight="700" fill="#475569">Computation</text>
      <text x="190" y="117" fontSize="7.5" fontWeight="700" fill="#475569">Challan</text>
      <text x="250" y="117" fontSize="7.5" fontWeight="700" fill="#475569">Others</text>

      {/* Uploaded files */}
      {[
        { name:'3B_May26.pdf', col:30, color:'#dc2626' },
        { name:'Comp_sheet.xlsx', col:110, color:'#16a34a' },
        { name:'Challan.pdf', col:190, color:'#0891b2' },
      ].map(f => (
        <g key={f.name}>
          <rect x={f.col-4} y="128" width="72" height="18" rx="4" fill={f.color} fillOpacity="0.08" stroke={f.color} strokeWidth="0.8" strokeOpacity="0.4"/>
          <text x={f.col} y="140" fontSize="6.5" fontWeight="600" fill={f.color}>{f.name}</text>
        </g>
      ))}

      {/* Divider */}
      <line x1="22" y1="155" x2="293" y2="155" stroke="#e2e8f0" strokeWidth="1"/>

      {/* Bulk assign + Priority row */}
      <rect x="22" y="161" width="85" height="18" rx="5" fill="#7c3aed" fillOpacity="0.1" stroke="#7c3aed" strokeWidth="0.8"/>
      <text x="64" y="173" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#7c3aed">👤 Bulk Assign</text>

      <rect x="115" y="161" width="75" height="18" rx="5" fill="#d97706" fillOpacity="0.1" stroke="#d97706" strokeWidth="0.8"/>
      <text x="152" y="173" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#d97706">⚡ Priority: High</text>

      <rect x="198" y="161" width="96" height="18" rx="5" fill="#0d9488" fillOpacity="0.1" stroke="#0d9488" strokeWidth="0.8"/>
      <text x="246" y="173" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#0d9488">📅 Due: 20 May</text>

      {/* Status strip */}
      <rect x="22" y="188" width="271" height="48" rx="8" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" strokeOpacity="0.4"/>
      <text x="34" y="203" fontSize="8" fontWeight="700" fill="#b45309">⏰  3 similar tasks for other clients this month</text>
      <text x="34" y="216" fontSize="7.5" fill="#b45309" fillOpacity="0.8">Shanti Chemicals · Sunrise Exports · Vista Pvt Ltd</text>
      <rect x="196" y="222" width="86" height="10" rx="3" fill="#b45309" fillOpacity="0.15"/>
      <text x="239" y="230" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#b45309">Assign All at Once →</text>
    </svg>
  )
}

function IllustrationTaskDetail() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Panel */}
      <rect x="10" y="8" width="300" height="244" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* Header */}
      <rect x="10" y="8" width="300" height="30" rx="12" fill="#0d9488" fillOpacity="0.08"/>
      <text x="22" y="27" fontSize="9.5" fontWeight="700" fill="#0d9488">ITR Filing — Ramesh Gupta</text>
      <rect x="264" y="13" width="36" height="16" rx="5" fill="#dc2626" fillOpacity="0.12" stroke="#dc2626" strokeWidth="0.8"/>
      <text x="282" y="24" textAnchor="middle" fontSize="7" fontWeight="700" fill="#dc2626">Overdue</text>

      {/* Attachments */}
      <text x="20" y="51" fontSize="8" fontWeight="700" fill="#475569">📎  ATTACHMENTS (3)</text>
      {[
        { name:'ITR_Computation.pdf', color:'#dc2626' },
        { name:'Form_26AS.xlsx', color:'#16a34a' },
        { name:'AIS_Report.pdf', color:'#0891b2' },
      ].map((f, i) => (
        <g key={f.name}>
          <rect x={20+i*91} y="55" width="86" height="20" rx="5" fill={f.color} fillOpacity="0.08" stroke={f.color} strokeWidth="0.8" strokeOpacity="0.5"/>
          <text x={63+i*91} y="68" textAnchor="middle" fontSize="6.5" fontWeight="600" fill={f.color}>{f.name.length>14 ? f.name.slice(0,14)+'…' : f.name}</text>
        </g>
      ))}

      {/* Blocked by */}
      <text x="20" y="92" fontSize="8" fontWeight="700" fill="#475569">🔗  BLOCKED BY</text>
      <rect x="20" y="96" width="280" height="18" rx="5" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8"/>
      <text x="30" y="108" fontSize="7.5" fill="#b45309">⚠️  Form 16 collection — Ramesh Gupta  ·  Waiting on client</text>

      {/* Comments */}
      <text x="20" y="127" fontSize="8" fontWeight="700" fill="#475569">💬  COMMENTS (2)</text>
      <rect x="20" y="131" width="280" height="32" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <circle cx="33" cy="147" r="8" fill="#7c3aed" fillOpacity="0.2"/>
      <text x="33" y="150" textAnchor="middle" fontSize="7" fontWeight="700" fill="#7c3aed">P</text>
      <text x="47" y="142" fontSize="8" fontWeight="600" fill="#1e293b">Priya S</text>
      <text x="47" y="154" fontSize="7.5" fill="#64748b">Waiting for Form 26AS from client, will update EOD</text>

      <rect x="20" y="167" width="280" height="28" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <circle cx="33" cy="181" r="8" fill="#0d9488" fillOpacity="0.2"/>
      <text x="33" y="184" textAnchor="middle" fontSize="7" fontWeight="700" fill="#0d9488">R</text>
      <text x="47" y="176" fontSize="8" fontWeight="600" fill="#1e293b">Rahul G</text>
      <text x="47" y="188" fontSize="7.5" fill="#64748b">Also check AIS — there were discrepancies last year</text>

      {/* Meta row */}
      <rect x="20" y="202" width="280" height="40" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      {[
        { label:'Due', val:'Jul 31', color:'#dc2626' },
        { label:'Priority', val:'High', color:'#d97706' },
        { label:'Assignee', val:'Priya S', color:'#7c3aed' },
        { label:'Approver', val:'Rahul G', color:'#0d9488' },
      ].map((m, i) => (
        <g key={m.label}>
          <text x={30+i*68} y="217" fontSize="6.5" fontWeight="600" fill="#94a3b8">{m.label}</text>
          <text x={30+i*68} y="232" fontSize="8" fontWeight="700" fill={m.color}>{m.val}</text>
        </g>
      ))}
    </svg>
  )
}

function IllustrationMonitor() {
  const members = [
    { name:'Priya S', done:8, total:12, color:'#0d9488' },
    { name:'Amit K',  done:5, total:9,  color:'#0891b2' },
    { name:'Neha R',  done:10,total:10, color:'#16a34a' },
    { name:'Karan J', done:2, total:8,  color:'#d97706' },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="10" y="8" width="300" height="244" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* Header */}
      <rect x="10" y="8" width="300" height="30" rx="12" fill="#7c3aed" fillOpacity="0.08"/>
      <text x="22" y="27" fontSize="10" fontWeight="700" fill="#7c3aed">Monitor</text>
      <rect x="244" y="13" width="56" height="16" rx="5" fill="#16a34a" fillOpacity="0.15" stroke="#16a34a" strokeWidth="0.8"/>
      <circle cx="252" cy="21" r="3" fill="#16a34a"/>
      <text x="268" y="24" fontSize="7.5" fontWeight="700" fill="#16a34a">LIVE</text>

      {/* Summary tiles */}
      {[
        { val:'25', label:'Total Tasks', color:'#0d9488' },
        { val:'7',  label:'Overdue',     color:'#dc2626' },
        { val:'4',  label:'In Review',   color:'#7c3aed' },
        { val:'14', label:'Done',        color:'#16a34a' },
      ].map((s, i) => (
        <g key={s.label}>
          <rect x={16+i*71} y="44" width="66" height="34" rx="7" fill={s.color} fillOpacity="0.08" stroke={s.color} strokeWidth="0.8" strokeOpacity="0.4"/>
          <text x={49+i*71} y="62" textAnchor="middle" fontSize="14" fontWeight="800" fill={s.color}>{s.val}</text>
          <text x={49+i*71} y="73" textAnchor="middle" fontSize="6.5" fontWeight="600" fill={s.color} fillOpacity="0.75">{s.label}</text>
        </g>
      ))}

      {/* Team workload */}
      <text x="18" y="96" fontSize="8" fontWeight="700" fill="#475569">TEAM WORKLOAD</text>
      {members.map((m, i) => {
        const pct = m.done / m.total
        return (
          <g key={m.name}>
            <circle cx="30" cy={107+i*30} r="9" fill={m.color} fillOpacity="0.18"/>
            <text x="30" y={110+i*30} textAnchor="middle" fontSize="7" fontWeight="700" fill={m.color}>{m.name[0]}</text>
            <text x="46" y={110+i*30} fontSize="8" fontWeight="600" fill="#1e293b">{m.name}</text>
            {/* progress bar track */}
            <rect x="100" y={101+i*30} width="150" height="10" rx="5" fill="#e2e8f0"/>
            {/* progress bar fill */}
            <rect x="100" y={101+i*30} width={150*pct} height="10" rx="5" fill={m.color} fillOpacity="0.85"/>
            <text x="258" y={110+i*30} fontSize="7.5" fontWeight="700" fill={m.color}>{m.done}/{m.total}</text>
          </g>
        )
      })}

      {/* Live activity feed */}
      <line x1="16" y1="230" x2="304" y2="230" stroke="#e2e8f0" strokeWidth="1"/>
      <text x="18" y="220" fontSize="7.5" fontWeight="700" fill="#475569">RECENT ACTIVITY</text>
      <text x="18" y="243" fontSize="7" fill="#64748b">✅  Priya S completed TDS Return — Mehta &amp; Sons  ·  2m ago</text>
    </svg>
  )
}

function IllustrationRecurring() {
  const freqs = [
    { label: 'Daily',     color: '#dc2626', active: false },
    { label: 'Weekly',    color: '#d97706', active: false },
    { label: 'Monthly',   color: '#0d9488', active: true  },
    { label: 'Quarterly', color: '#7c3aed', active: false },
  ]
  const instances = [
    { month: 'May 2026', status: 'done',     color: '#16a34a' },
    { month: 'Jun 2026', status: 'todo',     color: '#0d9488' },
    { month: 'Jul 2026', status: 'upcoming', color: '#94a3b8' },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      {/* Template card */}
      <rect x="15" y="10" width="290" height="58" rx="10" fill="#f0fdf9" stroke="#0d9488" strokeWidth="1.5" strokeDasharray="4 2"/>
      <text x="30" y="29" fontSize="8.5" fontWeight="800" fill="#0d9488" style={{textTransform:'uppercase'}}>🔁 Template (Master)</text>
      <text x="30" y="48" fontSize="11" fontWeight="700" fill="#1e293b">GSTR 3B Filing</text>
      <rect x="196" y="36" width="96" height="18" rx="5" fill="#0d9488" fillOpacity="0.12" stroke="#0d9488" strokeWidth="0.8" strokeOpacity="0.4"/>
      <text x="244" y="48" textAnchor="middle" fontSize="8" fontWeight="700" fill="#0d9488">Monthly · 20th</text>
      {/* Frequency row */}
      <text x="15" y="84" fontSize="7" fontWeight="800" fill="#94a3b8" style={{textTransform:'uppercase', letterSpacing:'0.08em'}}>FREQUENCY</text>
      {freqs.map((f, i) => (
        <g key={f.label}>
          <rect x={15+i*73} y="89" width="67" height="22" rx="7"
            fill={f.active ? f.color : 'white'}
            stroke={f.active ? f.color : '#e2e8f0'} strokeWidth={f.active ? 1.5 : 1}/>
          <text x={48+i*73} y="104" textAnchor="middle" fontSize="8.5"
            fontWeight={f.active ? '700' : '500'} fill={f.active ? 'white' : '#64748b'}>{f.label}</text>
        </g>
      ))}
      {/* Spawn arrow */}
      <text x="160" y="132" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#94a3b8">↓  auto-spawns a new task each cycle</text>
      {/* Spawned instances */}
      {instances.map((inst, i) => (
        <g key={inst.month}>
          <rect x={18+i*96} y="142" width="88" height="50" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <rect x={18+i*96} y="142" width="88" height="5" rx="2.5" fill={inst.color}/>
          <text x={62+i*96} y="163" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1e293b">GSTR 3B</text>
          <text x={62+i*96} y="174" textAnchor="middle" fontSize="7.5" fill="#64748b">{inst.month}</text>
          <rect x={28+i*96} y="180" width="68" height="13" rx="4"
            fill={inst.color} fillOpacity="0.1" stroke={inst.color} strokeWidth="0.6" strokeOpacity="0.4"/>
          <text x={62+i*96} y="190" textAnchor="middle" fontSize="7" fontWeight="700" fill={inst.color}>
            {inst.status === 'done' ? '✓ Done' : inst.status === 'todo' ? 'In Progress' : 'Upcoming'}
          </text>
        </g>
      ))}
      {/* Footer */}
      <rect x="15" y="203" width="290" height="47" rx="8" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8" strokeOpacity="0.5"/>
      <text x="30" y="220" fontSize="8" fontWeight="700" fill="#b45309">💡  Tasks spawn automatically before the due date</text>
      <text x="30" y="234" fontSize="7.5" fill="#b45309" fillOpacity="0.85">Every client gets their own copy · Assignee inherited from template</text>
    </svg>
  )
}

function IllustrationMultiOrg() {
  const orgs = [
    { name: 'SNG Advisers',       plan: 'Pro',     color: '#0d9488', active: true  },
    { name: 'Mehta & Associates', plan: 'Starter', color: '#7c3aed', active: false },
    { name: 'Priya CA Firm',      plan: 'Free',    color: '#0891b2', active: false },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="15" y="10" width="290" height="240" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* Header */}
      <rect x="15" y="10" width="290" height="32" rx="12" fill="#0d9488" fillOpacity="0.08"/>
      <text x="30" y="30" fontSize="10" fontWeight="700" fill="#0d9488">Switch Organisation</text>
      <text x="285" y="30" textAnchor="end" fontSize="8" fill="#94a3b8">⌘K</text>
      {/* Org rows */}
      {orgs.map((o, i) => (
        <g key={o.name}>
          <rect x="22" y={50+i*60} width="276" height="50" rx="10"
            fill={o.active ? '#f0fdf9' : 'white'}
            stroke={o.active ? '#0d9488' : '#e2e8f0'} strokeWidth={o.active ? 1.5 : 1}/>
          {/* Avatar */}
          <circle cx="50" cy={75+i*60} r="15" fill={o.color} fillOpacity={o.active ? 0.22 : 0.1}/>
          <text x="50" y={80+i*60} textAnchor="middle" fontSize="12" fontWeight="800" fill={o.color}>{o.name[0]}</text>
          {/* Name */}
          <text x="73" y={70+i*60} fontSize="11" fontWeight="700" fill={o.active ? '#0d9488' : '#1e293b'}>
            {o.name.length > 20 ? o.name.slice(0,19)+'…' : o.name}
          </text>
          {/* Plan badge */}
          <rect x="73" y={76+i*60} width="40" height="14" rx="4" fill={o.color} fillOpacity="0.12"/>
          <text x="93" y={86+i*60} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={o.color}>{o.plan}</text>
          {/* Active checkmark */}
          {o.active && (
            <g>
              <circle cx="276" cy={75+i*60} r="9" fill="#0d9488"/>
              <path d={`M271 ${75+i*60} L275 ${79+i*60} L281 ${70+i*60}`}
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
          )}
          {/* Hover arrow for inactive */}
          {!o.active && (
            <text x="277" y={79+i*60} textAnchor="middle" fontSize="12" fill="#cbd5e1">›</text>
          )}
        </g>
      ))}
      {/* Create new org */}
      <path d="M15 228 L305 228 L305 240 Q305 250 295 250 L35 250 Q15 250 15 240 Z" fill="#f0fdf9"/>
      <text x="160" y="243" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0d9488">＋  Create New Organisation</text>
    </svg>
  )
}

function IllustrationImport() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="15" y="10" width="290" height="240" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="15" y="10" width="290" height="32" rx="12" fill="#0891b2" fillOpacity="0.08"/>
      <text x="30" y="30" fontSize="10" fontWeight="700" fill="#0891b2">Import Clients</text>
      {/* Upload zone */}
      <rect x="22" y="50" width="276" height="72" rx="10" fill="#f0f9ff" stroke="#0891b2" strokeWidth="1.5" strokeDasharray="5 3"/>
      <text x="160" y="78" textAnchor="middle" fontSize="20">📥</text>
      <text x="160" y="96" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0891b2">Drop your Excel / CSV file here</text>
      <text x="160" y="110" textAnchor="middle" fontSize="8" fill="#64748b">or click to browse · .xlsx .csv supported</text>
      {/* Template download */}
      <rect x="22" y="132" width="276" height="28" rx="7" fill="#fef3c7" stroke="#d97706" strokeWidth="0.8"/>
      <text x="35" y="149" fontSize="8.5" fontWeight="700" fill="#b45309">⬇  Download starter template → fill GSTIN, Name, Group, DSC date</text>
      {/* Preview rows */}
      {[
        { name:'Shanti Chemicals', gstin:'27AABC5432N1Z8', group:'Manufacturing' },
        { name:'Mehta & Sons LLP',  gstin:'06XXYZ1234M1Z2', group:'Service' },
        { name:'Sunrise Exports',   gstin:'29PQRS9876K1Z5', group:'Manufacturing' },
      ].map((r, i) => (
        <g key={r.name}>
          <rect x="22" y={168+i*22} width="276" height="19" rx="4" fill={i%2===0?'white':'#f8fafc'} stroke="#f1f5f9" strokeWidth="0.8"/>
          <circle cx="33" cy={177+i*22} r="5" fill="#0891b2" fillOpacity="0.2"/>
          <text x="33" y={180+i*22} textAnchor="middle" fontSize="6" fontWeight="700" fill="#0891b2">{r.name[0]}</text>
          <text x="43" y={180+i*22} fontSize="7.5" fill="#1e293b">{r.name}</text>
          <text x="160" y={180+i*22} fontSize="7" fill="#64748b">{r.gstin}</text>
          <rect x="244" y={171+i*22} width="46" height="12" rx="3" fill="#0891b2" fillOpacity="0.1"/>
          <text x="267" y={180+i*22} textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#0891b2">{r.group}</text>
        </g>
      ))}
      <rect x="22" y="237" width="276" height="5" rx="2.5" fill="#e2e8f0"/>
      <rect x="22" y="237" width="196" height="5" rx="2.5" fill="#0891b2"/>
      <text x="30" y="250" fontSize="7" fill="#64748b">3 of 3 clients ready to import</text>
      <rect x="248" y="240" width="50" height="14" rx="4" fill="#0891b2"/>
      <text x="273" y="250" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="white">Import All</text>
    </svg>
  )
}

function IllustrationUploads() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="10" y="8" width="300" height="244" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="10" y="8" width="300" height="30" rx="12" fill="#0d9488" fillOpacity="0.08"/>
      <text x="22" y="27" fontSize="9.5" fontWeight="700" fill="#0d9488">ITR Filing — Ramesh Gupta · Attachments</text>
      {/* Upload button row */}
      <rect x="18" y="46" width="90" height="20" rx="6" fill="#0d9488"/>
      <text x="63" y="59" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white">📎  Upload File</text>
      <rect x="116" y="46" width="90" height="20" rx="6" fill="#4285f4" fillOpacity="0.15" stroke="#4285f4" strokeWidth="0.8"/>
      <text x="161" y="59" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#4285f4">🔗  Drive Link</text>
      <rect x="214" y="46" width="90" height="20" rx="6" fill="#6b7280" fillOpacity="0.1" stroke="#6b7280" strokeWidth="0.8"/>
      <text x="259" y="59" textAnchor="middle" fontSize="8" fontWeight="700" fill="#6b7280">📦  Dropbox Link</text>
      {/* Attachment slots */}
      {[
        { label:'Acknowledgement', file:'ITR_Ack_Gupta.pdf', color:'#dc2626', uploaded:true },
        { label:'Computation',     file:'Comp_2025-26.xlsx', color:'#16a34a', uploaded:true },
        { label:'Form 26AS',       file:null,                color:'#d97706', uploaded:false },
        { label:'AIS Report',      file:null,                color:'#94a3b8', uploaded:false },
      ].map((s, i) => (
        <g key={s.label}>
          <rect x="18" y={74+i*38} width="284" height="32" rx="7" fill="white" stroke={s.uploaded?s.color:'#e2e8f0'} strokeWidth={s.uploaded?1.2:0.8}/>
          <text x="30" y={87+i*38} fontSize="8" fontWeight="700" fill="#475569">{s.label}</text>
          {s.uploaded
            ? <>
                <rect x="160" y={80+i*38} width="110" height="18" rx="4" fill={s.color} fillOpacity="0.1"/>
                <text x="215" y={92+i*38} textAnchor="middle" fontSize="7.5" fontWeight="600" fill={s.color}>✓ {s.file}</text>
              </>
            : <text x="165" y={92+i*38} textAnchor="middle" fontSize="7.5" fill="#94a3b8">— not uploaded yet</text>
          }
        </g>
      ))}
      {/* Drive link paste area */}
      <rect x="18" y="230" width="284" height="18" rx="5" fill="#f0f9ff" stroke="#4285f4" strokeWidth="0.8" strokeDasharray="4 2"/>
      <text x="30" y="242" fontSize="7.5" fill="#4285f4">🔗 Paste Google Drive / Dropbox URL here and press Enter</text>
    </svg>
  )
}

function IllustrationReports() {
  const months = ['Nov','Dec','Jan','Feb','Mar','Apr','May']
  const completedData = [18,22,19,26,24,28,31]
  const overdueData   = [5,4,6,3,4,2,1]
  const maxVal = 35
  const barW = 24, gap = 14, startX = 38
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="10" y="8" width="300" height="244" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="10" y="8" width="300" height="30" rx="12" fill="#7c3aed" fillOpacity="0.08"/>
      <text x="22" y="27" fontSize="10" fontWeight="700" fill="#7c3aed">Reports</text>
      {/* Tabs */}
      {['Overview','Team','Compliance'].map((t,i) => (
        <g key={t}>
          <rect x={18+i*92} y="44" width="86" height="16" rx="4"
            fill={i===0?'#7c3aed':'transparent'} fillOpacity={i===0?1:0}
            stroke={i===0?'#7c3aed':'#e2e8f0'} strokeWidth={i===0?0:1}/>
          <text x={61+i*92} y="55" textAnchor="middle" fontSize="8" fontWeight={i===0?'700':'500'} fill={i===0?'white':'#94a3b8'}>{t}</text>
        </g>
      ))}
      {/* KPI tiles */}
      {[
        { label:'Tasks Created', val:'84', color:'#0d9488' },
        { label:'Completed',     val:'71', color:'#16a34a' },
        { label:'Overdue',       val:'3',  color:'#dc2626' },
        { label:'Hours Logged',  val:'142h',color:'#7c3aed' },
      ].map((k,i) => (
        <g key={k.label}>
          <rect x={18+i*70} y="68" width="64" height="36" rx="7" fill={k.color} fillOpacity="0.08" stroke={k.color} strokeWidth="0.6" strokeOpacity="0.4"/>
          <text x={50+i*70} y="84" textAnchor="middle" fontSize="13" fontWeight="800" fill={k.color}>{k.val}</text>
          <text x={50+i*70} y="95" textAnchor="middle" fontSize="5.5" fontWeight="600" fill={k.color} fillOpacity="0.75">{k.label}</text>
        </g>
      ))}
      {/* Bar chart */}
      <text x="18" y="118" fontSize="7.5" fontWeight="700" fill="#475569">TASKS — LAST 7 MONTHS</text>
      {months.map((m, i) => {
        const x = startX + i*(barW+gap)
        const hComp = (completedData[i]/maxVal)*80
        const hOver = (overdueData[i]/maxVal)*80
        return (
          <g key={m}>
            <rect x={x} y={200-hComp} width={barW*0.55} height={hComp} rx="3" fill="#16a34a" fillOpacity="0.7"/>
            <rect x={x+barW*0.6} y={200-hOver} width={barW*0.4} height={hOver} rx="3" fill="#dc2626" fillOpacity="0.7"/>
            <text x={x+barW*0.5} y="212" textAnchor="middle" fontSize="6.5" fill="#94a3b8">{m}</text>
          </g>
        )
      })}
      <line x1="18" y1="200" x2="302" y2="200" stroke="#e2e8f0" strokeWidth="1"/>
      {/* Legend */}
      <circle cx="26" cy="228" r="4" fill="#16a34a"/>
      <text x="34" y="232" fontSize="7" fill="#64748b">Completed</text>
      <circle cx="100" cy="228" r="4" fill="#dc2626"/>
      <text x="108" y="232" fontSize="7" fill="#64748b">Overdue</text>
      <text x="180" y="232" fontSize="7" fill="#64748b">Team · Compliance Report tabs →</text>
    </svg>
  )
}


// ── MSME Tracker illustration ──────────────────────────────────────────────
function IllustrationMsme() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="20" y="16" width="280" height="228" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* Header */}
      <rect x="20" y="16" width="280" height="34" rx="12" fill="#0891b2" fillOpacity="0.1"/>
      <text x="36" y="36" fontSize="11" fontWeight="700" fill="#0891b2">MSME Vendor Tracker</text>
      <rect x="232" y="24" width="56" height="18" rx="5" fill="#0891b2"/>
      <text x="260" y="36" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">+ Add Vendor</text>
      {/* Stats row */}
      {[
        { x:50,  val:'12', label:'Total', color:'#0891b2' },
        { x:120, val:'7',  label:'Submitted', color:'#16a34a' },
        { x:190, val:'3',  label:'Pending', color:'#ca8a04' },
        { x:260, val:'2',  label:'Locked', color:'#dc2626' },
      ].map(s => (
        <g key={s.label}>
          <rect x={s.x-28} y="58" width="56" height="28" rx="6" fill={s.color} fillOpacity="0.1" stroke={s.color} strokeWidth="0.8" strokeOpacity="0.3"/>
          <text x={s.x} y="73" textAnchor="middle" fontSize="13" fontWeight="800" fill={s.color}>{s.val}</text>
          <text x={s.x} y="82" textAnchor="middle" fontSize="7" fill={s.color} fillOpacity="0.7">{s.label}</text>
        </g>
      ))}
      {/* Vendor rows */}
      {[
        { name:'Shanti Traders', gstin:'27AABC…', status:'Submitted', color:'#16a34a', paid: true },
        { name:'Mehta Industries', gstin:'06XXYZ…', status:'Emailed', color:'#ca8a04', paid: true },
        { name:'Sunrise Exports', gstin:'—', status:'Pending', color:'#64748b', paid: false },
      ].map((v, i) => (
        <g key={v.name}>
          <rect x="28" y={98+i*46} width="264" height="38" rx="7" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          {!v.paid && <text x="38" y={98+i*46+22} fontSize="12">🔒</text>}
          <text x={v.paid ? 44 : 58} y={98+i*46+16} fontSize="10" fontWeight="600" fill="#1e293b">{v.name}</text>
          <text x={v.paid ? 44 : 58} y={98+i*46+28} fontSize="8" fill="#94a3b8">GSTIN: {v.gstin}</text>
          <rect x="200" y={98+i*46+10} width="56" height="16" rx="5" fill={v.color} fillOpacity="0.12"/>
          <text x="228" y={98+i*46+21} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={v.color}>{v.status}</text>
          {!v.paid && (
            <>
              <rect x="210" y={98+i*46+10} width="72" height="16" rx="5" fill="#ea580c" fillOpacity="0.12"/>
              <text x="246" y={98+i*46+21} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#ea580c">Pay ₹99</text>
            </>
          )}
        </g>
      ))}
      {/* Magic link form arrow */}
      <text x="160" y="240" textAnchor="middle" fontSize="8" fill="#64748b">Vendor receives magic-link → fills Udyam form → you get notified ✅</text>
    </svg>
  )
}

// ── Partner Portal illustration ────────────────────────────────────────────
function IllustrationPartner() {
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="20" y="16" width="280" height="228" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="20" y="16" width="280" height="34" rx="12" fill="#16a34a" fillOpacity="0.1"/>
      <text x="36" y="36" fontSize="11" fontWeight="700" fill="#16a34a">Partner Portal</text>
      <rect x="222" y="22" width="66" height="20" rx="5" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1"/>
      <text x="255" y="35" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#b45309">🥇 GOLD TIER</text>
      {/* Referral link */}
      <rect x="28" y="58" width="182" height="22" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
      <text x="38" y="73" fontSize="8" fill="#94a3b8">upfloat.co/signup?ref=SNGCA08</text>
      <rect x="216" y="58" width="76" height="22" rx="6" fill="#0d9488"/>
      <text x="254" y="73" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white">Copy Link</text>
      {/* Stat boxes */}
      {[
        { x:50,  val:'18', label:'Referred', color:'#0891b2' },
        { x:130, val:'11', label:'Paying', color:'#16a34a' },
        { x:210, val:'₹6,732', label:'Earned', color:'#7c3aed' },
        { x:280, val:'20%', label:'Rate', color:'#f59e0b' },
      ].map(s => (
        <g key={s.label}>
          <rect x={s.x-32} y="90" width="64" height="30" rx="6" fill={s.color} fillOpacity="0.08" stroke={s.color} strokeWidth="0.8" strokeOpacity="0.3"/>
          <text x={s.x} y="107" textAnchor="middle" fontSize="11" fontWeight="800" fill={s.color}>{s.val}</text>
          <text x={s.x} y="115" textAnchor="middle" fontSize="7" fill={s.color} fillOpacity="0.7">{s.label}</text>
        </g>
      ))}
      {/* Referred clients */}
      {[
        { name:'Kapoor & Associates', plan:'Pro', paid: true, commission: '₹990' },
        { name:'Ravi GST Consultants', plan:'Starter', paid: true, commission: '₹297' },
        { name:'Nirmala Tax Services', plan:'Free', paid: false, commission: '—' },
      ].map((c, i) => (
        <g key={c.name}>
          <rect x="28" y={132+i*36} width="264" height="28" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <text x="40" y={132+i*36+17} fontSize="10" fontWeight="600" fill="#1e293b">{c.name}</text>
          <rect x="198" y={132+i*36+6} width="38" height="14" rx="4" fill={c.paid ? '#dbeafe' : '#f1f5f9'}/>
          <text x="217" y={132+i*36+16} textAnchor="middle" fontSize="7.5" fontWeight="600" fill={c.paid ? '#1d4ed8' : '#64748b'}>{c.plan}</text>
          <text x="264" y={132+i*36+17} textAnchor="middle" fontSize="10" fontWeight="700" fill={c.paid ? '#16a34a' : '#94a3b8'}>{c.commission}</text>
        </g>
      ))}
      <text x="160" y="246" textAnchor="middle" fontSize="8" fill="#64748b">Request payout when balance ≥ ₹500 · Processed within 3–5 business days</text>
    </svg>
  )
}

// ── Audit Log illustration ─────────────────────────────────────────────────
function IllustrationAuditLog() {
  const rows = [
    { time: '09:14 AM', user: 'Anjali M.', action: 'Completed task', detail: 'GSTR-1 · ABC Corp', color: '#16a34a' },
    { time: '09:22 AM', user: 'Rahul K.', action: 'Uploaded doc',   detail: 'ITR filing · XYZ Ltd', color: '#0891b2' },
    { time: '10:01 AM', user: 'You',       action: 'Approved task',  detail: 'TDS Q3 · Mehta & Co', color: '#7c3aed' },
    { time: '10:45 AM', user: 'Anjali M.', action: 'Added comment',  detail: 'GST audit · Singh Pvt', color: '#f59e0b' },
    { time: '11:30 AM', user: 'Rahul K.', action: 'Status changed', detail: 'ROC filing · Kumar',   color: '#0d9488' },
  ]
  return (
    <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <rect x="20" y="16" width="280" height="228" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
      <rect x="20" y="16" width="280" height="34" rx="12" fill="#7c3aed" fillOpacity="0.1"/>
      <text x="36" y="36" fontSize="11" fontWeight="700" fill="#7c3aed">Activity Log</text>
      {/* Download button */}
      <rect x="224" y="22" width="68" height="20" rx="5" fill="#7c3aed"/>
      <text x="258" y="35" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">↓ Download CSV</text>
      {/* Column headers */}
      <text x="34"  y="64" fontSize="7" fontWeight="700" fill="#94a3b8">TIME</text>
      <text x="80"  y="64" fontSize="7" fontWeight="700" fill="#94a3b8">TEAM MEMBER</text>
      <text x="154" y="64" fontSize="7" fontWeight="700" fill="#94a3b8">ACTION</text>
      <text x="220" y="64" fontSize="7" fontWeight="700" fill="#94a3b8">DETAIL</text>
      <line x1="28" y1="68" x2="292" y2="68" stroke="#e2e8f0" strokeWidth="1"/>
      {/* Rows */}
      {rows.map((r, i) => (
        <g key={r.time}>
          <rect x="28" y={73+i*33} width="264" height="26" rx="5" fill={i % 2 === 0 ? 'white' : '#f8fafc'} stroke="#f1f5f9" strokeWidth="1"/>
          <text x="34"  y={73+i*33+16} fontSize="8"   fill="#64748b">{r.time}</text>
          <text x="80"  y={73+i*33+16} fontSize="9"   fontWeight="600" fill="#1e293b">{r.user}</text>
          <rect x="150" y={73+i*33+6} width="60" height="14" rx="4" fill={r.color} fillOpacity="0.12"/>
          <text x="180" y={73+i*33+16} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={r.color}>{r.action}</text>
          <text x="220" y={73+i*33+16} fontSize="7.5" fill="#64748b">{r.detail}</text>
        </g>
      ))}
      <text x="160" y="250" textAnchor="middle" fontSize="8" fill="#94a3b8">Every action logged · Export for compliance audits</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────────────────────────────────────────

interface Step {
  id:          string
  icon:        string
  color:       string
  accent:      string
  title:       string
  subtitle:    string
  body:        string
  bullets:     { emoji: string; text: string }[]
  path?:       string
  actionLabel?: string
  actionHref?: string
  Illustration: () => React.ReactElement
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    icon: '🏢', color: '#0d9488', accent: 'rgba(13,148,136,0.1)',
    title: 'Welcome to upFloat — Built for CA Firms',
    subtitle: 'The only practice management tool designed for Indian CA & CPA firms',
    body: "If your team is still tracking filings in Excel, sending deadline reminders on WhatsApp, or wondering who is working on what — upFloat fixes all of that. This 5-minute tour covers every feature so you know exactly where to click on day one. Use the arrows to go at your own pace, or jump to any slide from the dots below.",
    bullets: [
      { emoji: '📋', text: '69+ statutory tasks — GSTR-1, GSTR-3B, TDS Q1–Q4, ITR, ROC, PF, ESI, PT — auto-generated with correct Indian due dates, no configuration needed' },
      { emoji: '👥', text: 'Unlimited clients: GSTIN auto-fills name and state, DSC expiry tracker with colour-coded alerts, import from Excel in minutes' },
      { emoji: '✅', text: 'Built-in approval workflow: assignee submits → you review → approve or return with comments. Full audit trail with timestamps.' },
      { emoji: '📊', text: 'Reports & Monitor give you firm-wide visibility in 5 seconds — no status meetings, no WhatsApp "kya hua?" messages' },
      { emoji: '🏭', text: 'NEW: MSME Vendor Compliance Tracker — collect Udyam certificates from vendors automatically via magic-link emails' },
    ],
    Illustration: IllustrationWelcome,
  },
  {
    id: 'clients',
    icon: '👤', color: '#0891b2', accent: 'rgba(8,145,178,0.1)',
    title: 'Add Your Clients — One by One or in Bulk',
    subtitle: 'Sidebar → Clients → + Add Client  or  Import',
    body: "Every client becomes a complete workspace in upFloat — their compliance filings, ad-hoc tasks, documents, and team notes all in one place. Add them manually (GSTIN auto-fills everything) or import your entire client list from an Excel or CSV file in under 5 minutes.",
    bullets: [
      { emoji: '🆔', text: 'Type the GSTIN → business name, state, and entity type fill in automatically from the GST portal' },
      { emoji: '🔒', text: 'DSC expiry date: stored per client, colour-coded red when within 30 days of expiry' },
      { emoji: '📥', text: 'Import button: download the starter template, fill in your clients, and upload — done in minutes' },
      { emoji: '📂', text: 'Every compliance task, project, and document is linked to the client automatically' },
    ],
    path: '/clients',
    actionLabel: 'Add your first client',
    actionHref: '/clients',
    Illustration: IllustrationClients,
  },
  {
    id: 'import',
    icon: '📥', color: '#0891b2', accent: 'rgba(8,145,178,0.1)',
    title: 'Import All Your Clients in Minutes',
    subtitle: 'Clients → Import button → Upload Excel / CSV',
    body: "Already have a client list in Excel? Don't add them one by one. Download the upFloat import template, paste your client data (GSTIN, name, group, DSC date), and upload. All clients are created instantly — with groups, GSTIN, and DSC dates intact.",
    bullets: [
      { emoji: '⬇️', text: 'Download the ready-made Excel template — columns match exactly what upFloat needs' },
      { emoji: '📋', text: 'Fill in: Client Name, GSTIN, Group, DSC Expiry Date — all other fields are optional' },
      { emoji: '📤', text: 'Upload the file — upFloat validates each row and shows a preview before importing' },
      { emoji: '✅', text: 'All clients created in one go: groups, DSC dates, and GSTIN all carried across' },
    ],
    path: '/clients',
    actionLabel: 'Go to Clients',
    actionHref: '/clients',
    Illustration: IllustrationImport,
  },
  {
    id: 'client-groups',
    icon: '📁', color: '#0891b2', accent: 'rgba(8,145,178,0.1)',
    title: 'Organise Clients into Groups',
    subtitle: 'Clients → Groups tab → + New Group',
    body: "With 50 or 500 clients, groups are what keep the work organised. Create groups like 'GST Clients', 'Audit Clients', 'Individual ITR', or 'Manufacturing'. Assign filings, filter Kanban views, and pull compliance reports — all filtered by group.",
    bullets: [
      { emoji: '📁', text: 'Create unlimited groups — assign clients during import or directly from the client form' },
      { emoji: '⚡', text: 'Generate all compliance tasks for an entire group in one step — not one by one' },
      { emoji: '🔍', text: 'Filter Kanban board, Calendar, and Monitor by group to focus on one segment' },
      { emoji: '📊', text: 'Compliance Reports tab shows filing status broken down by group and client' },
    ],
    Illustration: IllustrationClientGroups,
  },
  {
    id: 'compliance',
    icon: '⚖️', color: '#b45309', accent: 'rgba(180,83,9,0.1)',
    title: 'CA Compliance — 69+ Filings, Auto-Generated',
    subtitle: 'Sidebar → CA Compliance → Generate Tasks',
    body: "This is the heart of upFloat. In exactly 3 clicks: (1) select the statutory task types your firm handles, (2) pick the clients it applies to, (3) click Generate. upFloat creates one task per client with the correct statutory due date. No manual entry, no missed filings.",
    bullets: [
      { emoji: '📋', text: 'Step 1 — Choose task types: GSTR-1, GSTR-3B, TDS Q1–Q4, ITR, ROC Annual Return, PF, ESI, PT…' },
      { emoji: '🧑‍💼', text: 'Step 2 — Select clients: individually, by group, or all clients at once' },
      { emoji: '⏰', text: 'Step 3 — Click Generate: tasks appear on your Kanban, pre-dated N days before the statutory deadline' },
      { emoji: '📅', text: 'All 69+ task types have correct Indian statutory deadlines pre-loaded — no configuration needed' },
    ],
    path: '/compliance',
    actionLabel: 'Open CA Compliance',
    actionHref: '/compliance',
    Illustration: IllustrationCompliance,
  },
  {
    id: 'ca-advanced',
    icon: '0️⃣', color: '#b45309', accent: 'rgba(180,83,9,0.1)',
    title: 'NIL Returns, Bulk Assign & Compliance Filings',
    subtitle: 'CA Compliance → click any task to open detail panel',
    body: "Each compliance task has its own filing checklist. Mark NIL returns in one click. Attach acknowledgement, computation, and challans to the correct slot. Select 50 tasks at once and assign them all to a team member — instead of doing it one by one.",
    bullets: [
      { emoji: '0️⃣', text: 'NIL Return: tick one checkbox — task is marked filed with nil values, no documents required' },
      { emoji: '📎', text: 'Per-task attachment slots: Acknowledgement · Computation · Challan · Others — each filed separately' },
      { emoji: '🔗', text: 'No file upload needed: paste a Google Drive or Dropbox URL and it attaches instantly' },
      { emoji: '⚡', text: 'Multi-select tasks → Bulk Assign: send all to one team member in a single action' },
    ],
    Illustration: IllustrationCAAdvanced,
  },
  {
    id: 'uploads',
    icon: '📎', color: '#0d9488', accent: 'rgba(13,148,136,0.1)',
    title: 'Upload & Share Documents on Any Task',
    subtitle: 'Click any task → Attachments section',
    body: "Every task — compliance filing, ad-hoc work, or project — has a dedicated attachments section. Upload PDFs and Excel files directly, or paste a Google Drive / Dropbox link. No more emailing files back and forth or hunting for documents in chat threads.",
    bullets: [
      { emoji: '📤', text: 'Upload files directly: PDFs, images, Excel, Word — stored securely in upFloat' },
      { emoji: '🔗', text: 'Paste a Google Drive or Dropbox link — it attaches in one click, no login required from the viewer' },
      { emoji: '📂', text: 'Compliance tasks have per-type slots: Acknowledgement, Computation, Challan, Form 26AS, etc.' },
      { emoji: '👁️', text: 'All attachments are visible to the assignee, approver, and managers — no extra sharing needed' },
    ],
    Illustration: IllustrationUploads,
  },
  {
    id: 'task-detail',
    icon: '📋', color: '#0d9488', accent: 'rgba(13,148,136,0.1)',
    title: 'Everything About a Task — In One Panel',
    subtitle: 'Click any task card to open the detail panel',
    body: "Every task in upFloat has a rich side panel. Attachments, threaded comments, blocked-by links, due date, priority, assignee, and approver — all in one place. Your team stops using WhatsApp for task updates because everything they need is already here.",
    bullets: [
      { emoji: '💬', text: 'Threaded comments on every task — tag a teammate with @name to notify them instantly' },
      { emoji: '🔗', text: '"Blocked by" field: mark that this task is waiting on another — shown as a warning badge' },
      { emoji: '👤', text: 'Assignee does the work · Approver reviews it — two separate fields, both notified automatically' },
      { emoji: '📎', text: 'Attach files or Drive/Dropbox links — visible to everyone with access to the task' },
    ],
    Illustration: IllustrationTaskDetail,
  },
  {
    id: 'kanban',
    icon: '📊', color: '#7c3aed', accent: 'rgba(124,58,237,0.1)',
    title: 'Kanban Board — See Every Task at a Glance',
    subtitle: 'Sidebar → My Tasks → Board tab',
    body: "The Kanban board is your firm's visual command centre. Every task sits in a column matching its status: To Do, In Progress, In Review, Done. Overdue tasks are highlighted automatically. Drag a card to the next column and the status updates instantly.",
    bullets: [
      { emoji: '🔴', text: 'Overdue column turns red automatically — no task can hide in the wrong status' },
      { emoji: '🖱️', text: 'Drag any card between columns to change status — no form, no button, instant update' },
      { emoji: '🔍', text: 'Filter bar: narrow by client, assignee, priority, or date range — all filters work together' },
      { emoji: '📋', text: 'Switch to List view for a sortable table of all tasks — same filters apply in both views' },
    ],
    path: '/tasks',
    Illustration: IllustrationKanban,
  },
  {
    id: 'approvals',
    icon: '✅', color: '#7c3aed', accent: 'rgba(124,58,237,0.1)',
    title: 'Built-In Approval Workflow',
    subtitle: 'My Tasks → Needs Approval tab',
    body: "upFloat has a two-step approval process baked in. The assignee completes the work and clicks 'Submit for Review'. The task goes into Pending Review. The approver gets an email notification and can approve (closes the task) or return it with a comment (sends it back for revision).",
    bullets: [
      { emoji: '📤', text: 'Assignee clicks Submit → task status changes to Pending Review automatically' },
      { emoji: '🔔', text: 'Approver gets an email + in-app notification the moment it is submitted' },
      { emoji: '✓', text: 'Approve → task closes with a timestamp · Return → reopens to assignee with the reviewer\'s comment' },
      { emoji: '🗂️', text: 'Every status change is logged: who did what and when — permanent, tamper-proof audit trail' },
    ],
    path: '/tasks',
    Illustration: IllustrationApproval,
  },
  {
    id: 'my-tasks',
    icon: '📋', color: '#059669', accent: 'rgba(5,150,105,0.1)',
    title: 'My Tasks — Start Every Day Here',
    subtitle: 'Sidebar → My Tasks',
    body: "My Tasks is the personal dashboard every team member opens at the start of their day. The stats bar at the top tells them exactly what needs attention: overdue items, today's tasks, tasks pending their approval, and completed count. No briefing call needed.",
    bullets: [
      { emoji: '⚠️', text: 'Stats strip: Overdue (red) · Due Today · Needs Approval · Completed — always up to date' },
      { emoji: '📋', text: 'My Tasks tab — toggle between Kanban board view and flat List view from the top-right corner' },
      { emoji: '⏳', text: 'Needs Approval tab — every task waiting for your sign-off, sorted by submission date' },
      { emoji: '📤', text: 'Assigned by Me tab — track every task you have delegated and its current live status' },
    ],
    path: '/tasks',
    actionLabel: 'Open My Tasks',
    actionHref: '/tasks',
    Illustration: IllustrationMyTasks,
  },
  {
    id: 'recurring',
    icon: '🔁', color: '#0d9488', accent: 'rgba(13,148,136,0.1)',
    title: 'Recurring Tasks — Set Once, Run Forever',
    subtitle: 'Sidebar → Repeat Tasks → + New Recurring Task',
    body: "Monthly GST filings, weekly client calls, quarterly reviews — set these up once as recurring templates and never think about them again. upFloat spawns a new independent task automatically before each due date, with the assignee already set.",
    bullets: [
      { emoji: '🔁', text: 'Frequencies: daily · every N days · weekly on specific days · bi-weekly · monthly · quarterly · annual' },
      { emoji: '📅', text: 'Each task spawns N days before the due date so work starts on time — not on the deadline day' },
      { emoji: '👤', text: 'Every spawned instance inherits the assignee and approver from the master template automatically' },
      { emoji: '📊', text: 'Repeat Tasks page lists all templates with last and next occurrence dates at a glance' },
    ],
    path: '/recurring',
    Illustration: IllustrationRecurring,
  },
  {
    id: 'calendar',
    icon: '📅', color: '#d97706', accent: 'rgba(217,119,6,0.1)',
    title: 'Calendar — Every Filing Deadline Visible',
    subtitle: 'Sidebar → Calendar',
    body: "The Calendar plots every task due date across your entire firm on a single month view — compliance, ad-hoc, recurring, and projects. Use it in weekly planning meetings to filter down to one client or one team member and see their exact workload for the month.",
    bullets: [
      { emoji: '📆', text: 'One calendar for everything: CA compliance, project tasks, recurring tasks, and one-off tasks' },
      { emoji: '🎨', text: 'Colour-coded: CA filings (amber) · Projects (violet) · Recurring (teal) · One-off (cyan)' },
      { emoji: '👤', text: 'Filter to a single team member\'s tasks — ideal for workload planning conversations' },
      { emoji: '⏰', text: 'CA compliance tasks appear 7 days before they are due so the team can plan in advance' },
    ],
    path: '/calendar',
    Illustration: IllustrationCalendar,
  },
  {
    id: 'monitor',
    icon: '📡', color: '#7c3aed', accent: 'rgba(124,58,237,0.1)',
    title: 'Monitor — Know Without Asking',
    subtitle: 'Sidebar → Monitor  (Manager, Admin & Owner only)',
    body: "Monitor is the management layer. It shows every team member's current workload, overdue count, in-review tasks, and live activity feed — without you having to ask anyone anything. Stop the daily 'what's the status?' WhatsApp message — open Monitor instead.",
    bullets: [
      { emoji: '📊', text: 'Workload progress bars per person — see who has capacity and who is buried at a glance' },
      { emoji: '🔴', text: 'Per-person overdue counter — surface problems before they become client escalations' },
      { emoji: '🔔', text: 'Live activity feed: every task update, comment, and status change with timestamp' },
      { emoji: '🎯', text: 'Filter by date range, client group, or individual team member for a focused view' },
    ],
    path: '/monitor',
    actionLabel: 'Open Monitor',
    actionHref: '/monitor',
    Illustration: IllustrationMonitor,
  },
  {
    id: 'reports',
    icon: '📈', color: '#7c3aed', accent: 'rgba(124,58,237,0.1)',
    title: 'Reports — Analytics & Actionable Insights',
    subtitle: 'Sidebar → Reports  (Starter plan and above)',
    body: "Reports has five tabs. Overview shows firm-wide KPIs and a 12-week trajectory chart. Action Items (⚡) shows exactly what needs your decision right now — grouped by person, not task. Team Performance shows top and bottom 3 performers. Compliance Report and WIP Report round out the picture.",
    bullets: [
      { emoji: '⚡', text: 'Action Items tab: overdue tasks grouped by team member, pending approvals by urgency, unassigned urgent tasks — all at a glance, no scrolling through lists' },
      { emoji: '📈', text: 'Company Trajectory chart: 12-week view of tasks added vs completed — a widening gap means growing backlog, take action immediately' },
      { emoji: '🏆', text: 'Team Performance: Star Performers (top 3) vs Needs Attention (bottom 3) — completion rate, on-time %, hours logged per person' },
      { emoji: '⚖️', text: 'Compliance Report tab: overdue and pending filings across all clients with date range and team member filters' },
      { emoji: '🔄', text: 'WIP Report: every in-progress task grouped by client with hours logged and a one-click invoice creation button' },
    ],
    path: '/reports',
    actionLabel: 'Open Reports',
    actionHref: '/reports',
    Illustration: IllustrationReports,
  },
  {
    id: 'team',
    icon: '👥', color: '#0d9488', accent: 'rgba(13,148,136,0.1)',
    title: 'Set Up Your Team',
    subtitle: 'Settings → Team → + Invite Member',
    body: "Add your entire staff before you start assigning tasks. Go to Settings → Team, enter their email address, choose their role, and click Send Invite. They get a magic-link email and can log in immediately — no password setup, no app download required.",
    bullets: [
      { emoji: '👑', text: 'Owner — full access including billing and the ability to delete the organisation' },
      { emoji: '🛡️', text: 'Admin — same as Owner except billing and org deletion' },
      { emoji: '📋', text: 'Manager — can view all tasks, approve work, and manage clients across the whole team' },
      { emoji: '👤', text: 'Member — sees only tasks assigned to them; their work stays private from other members' },
    ],
    path: '/settings',
    actionLabel: 'Go to Team Settings',
    actionHref: '/settings',
    Illustration: IllustrationTeam,
  },
  {
    id: 'multi-org',
    icon: '🏢', color: '#0d9488', accent: 'rgba(13,148,136,0.1)',
    title: 'Run Multiple Firms from One Login',
    subtitle: 'Click the org name at the top of the sidebar to switch',
    body: "If you run multiple practices, partnerships, or entities — each gets its own completely isolated organisation in upFloat. One login covers all of them. Switch between organisations instantly from the org switcher at the top of the sidebar — no re-login, no confusion.",
    bullets: [
      { emoji: '🏢', text: 'One upFloat account — unlimited organisations, switch in one click with zero re-login' },
      { emoji: '🔒', text: 'Fully isolated: clients, tasks, team, and settings never mix between organisations' },
      { emoji: '👥', text: 'Different roles per org — you can be Owner of one firm and a Manager in another' },
      { emoji: '➕', text: 'Create a new organisation any time from the switcher → "New organisation" button' },
    ],
    Illustration: IllustrationMultiOrg,
  },
  {
    id: 'msme-tracker',
    icon: '🏭', color: '#0891b2', accent: 'rgba(8,145,178,0.1)',
    title: 'MSME Vendor Compliance Tracker',
    subtitle: 'Sidebar → MSME Tracker (Manager, Admin & Owner only)',
    body: "Under the MSME Act, your clients are legally required to collect Udyam Registration Numbers from their MSME vendors and report outstanding amounts. upFloat automates this entirely: send magic-link emails to vendors, they fill the form online, you get notified when done.",
    bullets: [
      { emoji: '📧', text: 'Add vendor name + email → upFloat sends a branded magic-link email on your behalf (up to 3 reminders)' },
      { emoji: '📋', text: 'Vendor opens the link (no login needed) and fills: Udyam number, MSME category, nature of business, outstanding amount as on 31 March' },
      { emoji: '📎', text: 'Vendor uploads their Udyam certificate (PDF/JPG) — you can download it anytime from the dashboard' },
      { emoji: '🆓', text: 'First 5 vendors are free. After that, ₹99/vendor/year — a tiny fraction of the compliance fine risk' },
      { emoji: '📊', text: 'Bulk import vendors from Excel, export all data to Excel, and share WhatsApp links as an alternative to email' },
    ],
    path: '/msme',
    actionLabel: 'Open MSME Tracker',
    actionHref: '/msme',
    Illustration: IllustrationMsme,
  },
  {
    id: 'partner-portal',
    icon: '🤝', color: '#16a34a', accent: 'rgba(22,163,74,0.1)',
    title: 'Partner Portal — Earn by Referring upFloat',
    subtitle: 'Sidebar → Partner Portal (Org Owner only)',
    body: "Every CA firm owner has a personal referral link. When you refer another CA or business owner to upFloat and they sign up and pay — you earn a commission on their subscription, every year, for as long as they stay. No cap, no expiry.",
    bullets: [
      { emoji: '🔗', text: 'Your unique referral link is one click to copy — share on WhatsApp, email, or LinkedIn' },
      { emoji: '💰', text: 'Bronze (1–4 referrals): 10% · Silver (5–9): 15% · Gold (10+): 20% — commission grows with your network' },
      { emoji: '👁️', text: 'Dashboard shows: who joined, their plan tier, whether they are paying, and your commission status' },
      { emoji: '🏦', text: 'Request a payout once your balance hits ₹500 — enter your bank account details and we transfer within 3–5 days' },
      { emoji: '🔒', text: 'What stays private: exact subscription amount your referral pays — you see your commission, not their invoice' },
    ],
    path: '/partner',
    actionLabel: 'Open Partner Portal',
    actionHref: '/partner',
    Illustration: IllustrationPartner,
  },
  {
    id: 'audit-log',
    icon: '📋', color: '#7c3aed', accent: 'rgba(124,58,237,0.1)',
    title: 'Activity Log — Complete Audit Trail',
    subtitle: 'Activity Log (sidebar) → Download CSV',
    body: "Every action taken in your firm is recorded: who completed a task, who uploaded a document, who approved what and when. This is your compliance paper trail — essential for firm accountability, client disputes, and tax audits.",
    bullets: [
      { emoji: '🕐', text: 'Timestamped entries for every task completion, status change, comment, document upload, and approval' },
      { emoji: '👤', text: 'Filtered by team member — instantly see what any specific person did this week or month' },
      { emoji: '📂', text: 'Filter by client or project to get a full history of every action taken for a specific client' },
      { emoji: '⬇️', text: 'Download as CSV with one click — hand the audit log to your quality reviewer or attach to your firm audit file' },
      { emoji: '🔒', text: 'Logs are read-only and append-only — no one can delete or edit past entries, so the record is always clean' },
    ],
    path: '/activity',
    actionLabel: 'Open Activity Log',
    actionHref: '/activity',
    Illustration: IllustrationAuditLog,
  },
  {
    id: 'done',
    icon: '🚀', color: '#16a34a', accent: 'rgba(22,163,74,0.1)',
    title: "Your Firm is Ready — First 30 Minutes Action Plan",
    subtitle: 'Follow this sequence to be fully operational today',
    body: "You have seen every feature. Here is the exact sequence that most CA firms follow — they complete all four steps in under 30 minutes and start saving hours every single week from that day forward. Each step unlocks the next.",
    bullets: [
      { emoji: '1️⃣', text: 'Clients → Import: download the starter template, paste your client list, upload. All clients created in one go with GSTIN, DSC dates, and groups.' },
      { emoji: '2️⃣', text: 'CA Compliance → Generate Tasks: select task types (GSTR-1, TDS, ITR, etc.), pick clients or entire groups, click Generate. Filing tasks appear instantly with correct due dates.' },
      { emoji: '3️⃣', text: 'Settings → Team → Invite: add every team member with their email and role. They get a magic-link, no password needed. Assign tasks to them immediately.' },
      { emoji: '4️⃣', text: 'Check Monitor daily (5 seconds): who has overdue work, who submitted for approval, who has capacity. No more WhatsApp status messages needed.' },
    ],
    actionLabel: '→ Start: Import your clients now',
    actionHref: '/clients',
    Illustration: IllustrationDone,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'upfloat_wt_v3_'
const MAX_AGE_MS     = 14 * 24 * 60 * 60 * 1000   // show to accounts < 14 days old

const CONFETTI_COLORS = ['#0d9488','#7c3aed','#0891b2','#d97706','#16a34a','#ec4899','#f43f5e']

function storageKey(userId: string) { return STORAGE_PREFIX + userId }

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  userId:          string
  userCreatedAt:   string
  tourCompletedAt: string | null
  /** Render as a full-page experience instead of a modal overlay */
  standalone?:     boolean
}

export function WalkthroughOverlay({ userId, userCreatedAt, tourCompletedAt, standalone = false }: Props) {
  const router = useRouter()
  const [step,           setStep]     = useState(0)
  const [visible,        setVisible]  = useState(standalone) // standalone always visible
  const [mounted,        setMounted]  = useState(false)
  const [confettiActive, setConfetti] = useState(false)
  const [animDir,        setAnimDir]  = useState<'forward'|'back'>('forward')
  const [animKey,        setAnimKey]  = useState(0)

  const confettiPieces = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id:    i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left:  4 + (i / 50) * 92,
      delay: i * 0.015,
      size:  5 + (i % 6),
      round: i % 3 === 0,
      speed: 0.65 + (i % 5) * 0.14,
    }))
  , [])

  // 1. Mount guard
  useEffect(() => { setMounted(true) }, [])

  // 2. Show for new users who haven't completed the tour (modal mode only)
  useEffect(() => {
    if (standalone) return   // page mode — always show
    if (!mounted) return
    if (tourCompletedAt) return
    const age = Date.now() - new Date(userCreatedAt).getTime()
    if (age > MAX_AGE_MS) return
    const done = localStorage.getItem(storageKey(userId))
    if (!done) setVisible(true)
  }, [mounted, userId, userCreatedAt, tourCompletedAt, standalone])

  // 3. Keyboard navigation
  useEffect(() => {
    if (!visible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')      { dismiss(); return }
      if (e.key === 'ArrowRight')  { advance(); return }
      if (e.key === 'ArrowLeft')   { retreat(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step])

  function dismiss() {
    if (standalone) {
      router.push('/dashboard')
      return
    }
    localStorage.setItem(storageKey(userId), '1')
    setVisible(false)
    fetch('/api/user/tour-complete', { method: 'POST' }).catch(() => {})
  }

  function goTo(n: number, dir: 'forward'|'back' = 'forward') {
    setAnimDir(dir)
    setAnimKey(k => k + 1)
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)))
  }

  function advance() {
    if (step === STEPS.length - 1) { dismiss(); return }
    const next = STEPS[step + 1]
    if (!standalone && next?.path) router.push(next.path)
    goTo(step + 1, 'forward')
  }

  function retreat() {
    if (step > 0) goTo(step - 1, 'back')
  }

  function handleFinish() {
    setConfetti(true)
    if (!standalone && STEPS[step].actionHref) router.push(STEPS[step].actionHref!)
    setTimeout(() => dismiss(), 1400)
  }

  if (!mounted || !visible) return null

  const cur    = STEPS[step]
  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1
  const pct     = Math.round(((step + 1) / STEPS.length) * 100)
  const { Illustration } = cur

  const cardContent = (
    <>
      {/* ── Global styles ── */}
      <style>{`
        @keyframes wt-slide-in-fwd  { from { opacity:0; transform:translateX(32px) scale(0.98); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes wt-slide-in-back { from { opacity:0; transform:translateX(-32px) scale(0.98); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes wt-illus-in      { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
        @keyframes wt-chip-in       { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes wt-confetti-fall { 0%{transform:translateY(-20px) rotate(0) scale(1);opacity:1} 100%{transform:translateY(105vh) rotate(540deg) scale(0.8);opacity:0} }
        .wt-card-inner { animation: var(--wt-anim) 0.3s cubic-bezier(0.34,1.25,0.64,1) both; }
        .wt-illus      { animation: wt-illus-in 0.4s 0.05s cubic-bezier(0.34,1.25,0.64,1) both; }
        .wt-chip       { animation: wt-chip-in 0.25s ease both; }
        .wt-nav-btn    { transition: all 0.15s ease; }
        .wt-nav-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .wt-dot        { cursor:pointer; border:none; padding:0; transition:all 0.2s ease; }
        .wt-dot:hover  { opacity:0.75; }
        .wt-action:hover { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 8px 24px var(--wt-shadow) !important; }
        .wt-action     { transition:all 0.15s ease; }
      `}</style>

      {/* ── Confetti burst ── */}
      {confettiActive && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999999, overflow:'hidden' }}>
          {confettiPieces.map(p => (
            <div key={p.id} style={{ position:'absolute', left:`${p.left}%`, top:'-12px',
              width:p.size, height:p.size, background:p.color, borderRadius:p.round?'50%':3,
              animation:`wt-confetti-fall ${p.speed}s ${p.delay}s ease-in forwards` }}/>
          ))}
        </div>
      )}

      {/* ── Wrapper: backdrop (modal) or page container (standalone) ── */}
      <div style={standalone ? {
          display:'flex', alignItems:'flex-start', justifyContent:'center',
          padding:'0', width:'100%',
        } : {
          position:'fixed', inset:0, background:'rgba(2,8,20,0.72)',
          backdropFilter:'blur(3px)', zIndex:99990, display:'flex',
          alignItems:'center', justifyContent:'center', padding:'16px',
        }}
        onClick={undefined}>

        {/* ── Main card ── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{ width:'100%', maxWidth:860, borderRadius:24,
            background:'var(--surface)', overflow:'hidden',
            boxShadow:'0 40px 100px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.2)',
            display:'flex', flexDirection:'column' }}>

          {/* Progress bar */}
          <div style={{ height:3, background:'var(--border-light)', position:'relative', flexShrink:0 }}>
            <div style={{ position:'absolute', inset:0, width:`${pct}%`,
              background:`linear-gradient(90deg,${cur.color},${cur.color}aa)`,
              transition:'width 0.4s cubic-bezier(0.65,0,0.35,1)', borderRadius:99 }}/>
          </div>

          {/* Body */}
          <div style={{ display:'flex', flex:1, minHeight:420, maxHeight:'calc(100vh - 120px)' }}>

            {/* ── Left: Illustration panel ── */}
            <div className="wt-illus"
              key={`illus-${animKey}`}
              style={{ width:'42%', flexShrink:0, display:'flex', alignItems:'center',
                justifyContent:'center', padding:'28px 20px 24px 28px',
                background:`linear-gradient(145deg, ${cur.accent}, ${cur.accent.replace('0.1','0.04')})`,
                borderRight:'1px solid var(--border)' }}>
              <Illustration/>
            </div>

            {/* ── Right: Content panel ── */}
            <div
              key={`content-${animKey}`}
              className="wt-card-inner"
              style={{ flex:1, padding:'28px 28px 24px', display:'flex', flexDirection:'column',
                overflowY:'auto',
                ['--wt-anim' as any]: animDir === 'forward' ? 'wt-slide-in-fwd' : 'wt-slide-in-back' }}>

              {/* Top row: step counter + close */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:cur.accent,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                    {cur.icon}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
                    textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    {isFirst ? 'Getting started' : isLast ? 'All done' : `Step ${step} of ${STEPS.length - 2}`}
                  </span>
                </div>
                <button onClick={dismiss} title="Skip tour"
                  style={{ width:28, height:28, borderRadius:8, border:'none',
                    background:'var(--surface-subtle)', cursor:'pointer', display:'flex',
                    alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}
                  onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.background='rgba(220,38,38,0.12)'; el.style.color='#dc2626' }}
                  onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.background='var(--surface-subtle)'; el.style.color='var(--text-muted)' }}>
                  <X size={13}/>
                </button>
              </div>

              {/* Subtitle — where to find it */}
              <div style={{ fontSize:10, fontWeight:700, color:cur.color, textTransform:'uppercase',
                letterSpacing:'0.1em', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ display:'inline-block', width:14, height:2, background:cur.color, borderRadius:99 }}/>
                {cur.subtitle}
              </div>

              {/* Title */}
              <h2 style={{ margin:'0 0 10px', fontSize:22, fontWeight:800, color:'var(--text-primary)', lineHeight:1.2 }}>
                {cur.title}
              </h2>

              {/* Body */}
              <p style={{ margin:'0 0 18px', fontSize:13, color:'var(--text-secondary)', lineHeight:1.75 }}>
                {cur.body}
              </p>

              {/* Bullet points */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18, flex:1 }}>
                {cur.bullets.map((b, i) => (
                  <div key={i} className="wt-chip"
                    style={{ display:'flex', alignItems:'flex-start', gap:10,
                      animationDelay:`${i * 50}ms` }}>
                    <span style={{ width:26, height:26, borderRadius:8, background:cur.accent,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:13, flexShrink:0 }}>{b.emoji}</span>
                    <span style={{ fontSize:12.5, color:'var(--text-primary)', lineHeight:1.55, paddingTop:4 }}>{b.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA action button */}
              {cur.actionHref && !isFirst && (
                <button className="wt-action"
                  onClick={() => { router.push(cur.actionHref!); if (isLast) handleFinish() }}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    padding:'10px 18px', borderRadius:12, marginBottom:16, width:'100%',
                    background:`linear-gradient(135deg,${cur.color},${cur.color}cc)`,
                    color:'#fff', fontSize:13, fontWeight:700, border:'none', cursor:'pointer',
                    boxShadow:`0 4px 16px ${cur.color}40`,
                    ['--wt-shadow' as any]: `${cur.color}55` }}>
                  {cur.actionLabel}
                  <ArrowRight size={14}/>
                </button>
              )}

              {/* Step dots */}
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:16 }}>
                {STEPS.map((_, i) => (
                  <button key={i} className="wt-dot" onClick={() => goTo(i, i > step ? 'forward' : 'back')}
                    title={`Step ${i+1}`}
                    style={{ width: i===step ? 22 : 6, height:6, borderRadius:99, border:'none',
                      background: i===step ? cur.color : i<step ? `${cur.color}55` : 'var(--border)',
                      boxShadow: i===step ? `0 0 6px ${cur.color}60` : 'none' }}/>
                ))}
                <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text-muted)' }}>← →</span>
              </div>

              {/* Navigation row */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={dismiss} style={{ fontSize:11, fontWeight:500, color:'var(--text-muted)',
                  background:'none', border:'none', cursor:'pointer', padding:'6px 0', marginRight:'auto' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='var(--text-secondary)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='var(--text-muted)'}>
                  Skip tour
                </button>

                {step > 0 && (
                  <button onClick={retreat} className="wt-nav-btn"
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 16px',
                      borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface)',
                      color:'var(--text-secondary)', fontSize:13, fontWeight:600, cursor:'pointer' }}
                    onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor='var(--brand)'; el.style.background='var(--surface-subtle)' }}
                    onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.borderColor='var(--border)'; el.style.background='var(--surface)' }}>
                    <ChevronLeft size={14}/> Back
                  </button>
                )}

                <button onClick={isLast ? handleFinish : advance} className="wt-nav-btn"
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px',
                    borderRadius:10, border:'none',
                    background:`linear-gradient(135deg,${cur.color},${cur.color}cc)`,
                    color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                    boxShadow:`0 4px 14px ${cur.color}45` }}>
                  {isFirst
                    ? <><span>Start Tour</span><ChevronRight size={14}/></>
                    : isLast
                    ? <><CheckCircle2 size={14}/><span>Add First Client</span></>
                    : <><span>Next</span><ChevronRight size={14}/></>
                  }
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (standalone) return cardContent
  return createPortal(cardContent, document.body)
}
