/** Shared types and utilities for the CA Compliance module.
 *  Import from here — NOT from the page component — to avoid cross-route deps.
 */

export type ComplianceFrequency = 'monthly' | 'quarterly' | 'annual' | 'one_time'

export interface AttachmentConfig { name: string }

export interface TaskOverride {
  title:       string
  frequency:   ComplianceFrequency
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
