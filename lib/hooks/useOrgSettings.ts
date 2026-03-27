'use client'
import { useState, useEffect, useCallback } from 'react'

export interface CustomFieldDef {
  key: string; label: string; type: string; placeholder?: string; options?: string[]
}
export interface TaskFields {
  [key: string]: { visible: boolean; mandatory: boolean }
}
export interface NavFeatures {
  one_time_tasks:     boolean
  recurring_tasks:    boolean
  projects:           boolean
  clients:            boolean
  time_tracking:      boolean
  reports:            boolean
  calendar:           boolean
  import_data:        boolean
  team:               boolean
  permissions:        boolean
  ca_compliance_mode: boolean
}
interface OrgSettings {
  customFields:     CustomFieldDef[]
  taskFields:       TaskFields
  caComplianceMode: boolean
  navFeatures:      NavFeatures
  loading:          boolean
}

const DEFAULT_TASK_FIELDS: TaskFields = {
  assignee:        { visible: true, mandatory: false },
  due_date:        { visible: true, mandatory: false },
  priority:        { visible: true, mandatory: false },
  client:          { visible: true, mandatory: false },
  attachment:      { visible: true, mandatory: false },
  approver:        { visible: true, mandatory: false },
  description:     { visible: true, mandatory: false },
  estimated_hours: { visible: true, mandatory: false },
}

// All nav items ON by default, compliance OFF by default
const DEFAULT_NAV: NavFeatures = {
  one_time_tasks:     true,
  recurring_tasks:    true,
  projects:           true,
  clients:            true,
  time_tracking:      true,
  reports:            true,
  calendar:           true,
  import_data:        true,
  team:               true,
  permissions:        false,
  ca_compliance_mode: false,
}

// Global state shared across all hook instances
let _cache: OrgSettings | null = null
let _listeners: Array<(s: OrgSettings) => void> = []

function notifyAll(s: OrgSettings) {
  _cache = s
  _listeners.forEach(fn => fn(s))
}

async function fetchSettings(): Promise<OrgSettings> {
  try {
    const [customRes, fieldsRes, featuresRes] = await Promise.all([
      fetch('/api/settings/custom-fields').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/settings/fields').then(r => r.json()).catch(() => ({ data: null })),
      fetch('/api/settings/features').then(r => r.json()).catch(() => ({ data: {} })),
    ])
    const raw = featuresRes.data ?? {}
    const nav: NavFeatures = {
      one_time_tasks:     raw.one_time_tasks     !== undefined ? raw.one_time_tasks     : true,
      recurring_tasks:    raw.recurring_tasks    !== undefined ? raw.recurring_tasks    : true,
      projects:           raw.projects           !== undefined ? raw.projects           : true,
      clients:            raw.clients            !== undefined ? raw.clients            : true,
      time_tracking:      raw.time_tracking      !== undefined ? raw.time_tracking      : true,
      reports:            raw.reports            !== undefined ? raw.reports            : true,
      calendar:           raw.calendar           !== undefined ? raw.calendar           : true,
      import_data:        raw.import_data        !== undefined ? raw.import_data        : true,
      team:               raw.team               !== undefined ? raw.team               : true,
      permissions:        raw.permissions        !== undefined ? raw.permissions        : false,
      ca_compliance_mode: raw.ca_compliance_mode !== undefined ? raw.ca_compliance_mode : false,
    }
    return {
      customFields:     customRes.data ?? [],
      taskFields:       fieldsRes.data ? { ...DEFAULT_TASK_FIELDS, ...fieldsRes.data } : DEFAULT_TASK_FIELDS,
      caComplianceMode: nav.ca_compliance_mode,
      navFeatures:      nav,
      loading:          false,
    }
  } catch {
    return { customFields: [], taskFields: DEFAULT_TASK_FIELDS, caComplianceMode: false, navFeatures: DEFAULT_NAV, loading: false }
  }
}

export function useOrgSettings(): OrgSettings {
  const [state, setState] = useState<OrgSettings>(
    _cache ?? { customFields: [], taskFields: DEFAULT_TASK_FIELDS, caComplianceMode: false, navFeatures: DEFAULT_NAV, loading: true }
  )

  useEffect(() => {
    // Register as listener so we get notified when any instance refreshes
    _listeners.push(setState)

    // If we have cache use it, otherwise fetch
    if (_cache) {
      setState(_cache)
    } else {
      fetchSettings().then(s => notifyAll(s))
    }

    return () => {
      _listeners = _listeners.filter(fn => fn !== setState)
    }
  }, [])

  return state
}

// Call this after saving a feature toggle - refreshes ALL hook instances immediately
export async function refreshOrgSettings() {
  const s = await fetchSettings()
  notifyAll(s)
}

// Kept for backward compatibility
export function clearOrgSettingsCache() {
  _cache = null
}
