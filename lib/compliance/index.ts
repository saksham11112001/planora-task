/** Shared types and utilities for the CA Compliance module. */

export type ComplianceFrequency = string   // widened — accepts any date-specific value

export const COMPLIANCE_FREQUENCIES: { group: string; v: string; l: string }[] = [
  { group:'Monthly',   v:'monthly_7',      l:'7th of every month' },
  { group:'Monthly',   v:'monthly_10',     l:'10th of every month' },
  { group:'Monthly',   v:'monthly_11',     l:'11th of every month' },
  { group:'Monthly',   v:'monthly_13',     l:'13th of every month' },
  { group:'Monthly',   v:'monthly_15',     l:'15th of every month' },
  { group:'Monthly',   v:'monthly_20',     l:'20th of every month' },
  { group:'Monthly',   v:'monthly_25',     l:'25th of every month' },
  { group:'Monthly',   v:'monthly_last',   l:'Last day of month' },
  { group:'Monthly',   v:'monthly',        l:'Monthly (same date)' },
  { group:'Quarterly', v:'quarterly_13',   l:'13th of quarter-end' },
  { group:'Quarterly', v:'quarterly_15',   l:'15th of quarter-end' },
  { group:'Quarterly', v:'quarterly_25',   l:'25th of quarter-end' },
  { group:'Quarterly', v:'quarterly_last', l:'Last day of quarter' },
  { group:'Quarterly', v:'quarterly',      l:'Quarterly (same date)' },
  { group:'Annual',    v:'annual_31jul',   l:'31st July (annual)' },
  { group:'Annual',    v:'annual_30sep',   l:'30th September (annual)' },
  { group:'Annual',    v:'annual_31dec',   l:'31st December (annual)' },
  { group:'Annual',    v:'annual_31mar',   l:'31st March (annual)' },
  { group:'Annual',    v:'annual',         l:'Annually (same date)' },
  { group:'One-time',  v:'one_time',       l:'One-time only' },
]

export function getFreqLabel(v: string): string {
  return COMPLIANCE_FREQUENCIES.find(f => f.v === v)?.l ?? v
}

export function getFreqColor(v: string): { bg: string; color: string } {
  if (v.startsWith('monthly'))   return { bg:'#eff6ff', color:'#1d4ed8' }
  if (v.startsWith('quarterly')) return { bg:'#fef3c7', color:'#b45309' }
  if (v.startsWith('annual'))    return { bg:'#fdf4ff', color:'#7e22ce' }
  return { bg:'#f0fdf4', color:'#166534' }
}

export interface AttachmentConfig { name: string }

export interface TaskOverride {
  title:       string
  frequency:   string
  priority:    'high' | 'medium' | 'low'
  description: string
  attachments: AttachmentConfig[]
}

export type OrgOverrides = Record<string, TaskOverride>

const LS_KEY = 'planora_compliance_overrides'

export function loadOverrides(): OrgOverrides {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}

export function saveOverrides(o: OrgOverrides): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(o))
}

/* ── Custom tasks (org-specific additions not in default list) ── */

export interface CustomTask {
  _id:         string
  title:       string
  group:       string
  category:    string
  frequency:   string
  priority:    'high' | 'medium' | 'low'
  description: string
  attachments: AttachmentConfig[]
}

const CUSTOM_KEY = 'planora_compliance_custom'

export function loadCustomTasks(): CustomTask[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') } catch { return [] }
}

export function saveCustomTasks(tasks: CustomTask[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(tasks))
}
