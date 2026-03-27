'use client'
import { useState, useEffect } from 'react'

export interface CustomFieldDef {
  key: string; label: string; type: string; placeholder?: string; options?: string[]
}

export interface TaskFields {
  [key: string]: { visible: boolean; mandatory: boolean }
}

export interface NavFeatures {
  one_time_tasks:    boolean
  recurring_tasks:   boolean
  projects:          boolean
  clients:           boolean
  time_tracking:     boolean
  reports:           boolean
  calendar:          boolean
  import_data:       boolean
  team:              boolean
  permissions:       boolean
  ca_compliance_mode: boolean
}

interface OrgSettings {
  customFields:       CustomFieldDef[]
  taskFields:         TaskFields
  caComplianceMode:   boolean
  navFeatures:        NavFeatures
  loading:            boolean
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

// All navigation items default to ON
const DEFAULT_NAV: NavFeatures = {
  one_time_tasks:    true,
  recurring_tasks:   true,
  projects:          true,
  clients:           true,
  time_tracking:     true,
  reports:           true,
  calendar:          true,
  import_data:       true,
  team:              true,
  permissions:       false,
  ca_compliance_mode: false,
}

let _cache: OrgSettings | null = null
let _cacheTime = 0
const TTL = 60_000

export function useOrgSettings(): OrgSettings {
  const [state, setState] = useState<OrgSettings>(
    _cache ?? { customFields: [], taskFields: DEFAULT_TASK_FIELDS, caComplianceMode: false, navFeatures: DEFAULT_NAV, loading: true }
  )

  useEffect(() => {
    if (_cache && Date.now() - _cacheTime < TTL) { setState(_cache); return }
    Promise.all([
      fetch('/api/settings/custom-fields').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/settings/fields').then(r => r.json()).catch(() => ({ data: null })),
      fetch('/api/settings/features').then(r => r.json()).catch(() => ({ data: {} })),
    ]).then(([customRes, fieldsRes, featuresRes]) => {
      const raw = featuresRes.data ?? {}
      const nav: NavFeatures = {
        one_time_tasks:    raw.one_time_tasks    ?? true,
        recurring_tasks:   raw.recurring_tasks   ?? true,
        projects:          raw.projects          ?? true,
        clients:           raw.clients           ?? true,
        time_tracking:     raw.time_tracking     ?? true,
        reports:           raw.reports           ?? true,
        calendar:          raw.calendar          ?? true,
        import_data:       raw.import_data       ?? true,
        team:              raw.team              ?? true,
        permissions:       raw.permissions       ?? false,
        ca_compliance_mode: raw.ca_compliance_mode ?? false,
      }
      const s: OrgSettings = {
        customFields:     customRes.data ?? [],
        taskFields:       fieldsRes.data ? { ...DEFAULT_TASK_FIELDS, ...fieldsRes.data } : DEFAULT_TASK_FIELDS,
        caComplianceMode: nav.ca_compliance_mode,
        navFeatures:      nav,
        loading:          false,
      }
      _cache = s; _cacheTime = Date.now()
      setState(s)
    })
  }, [])

  return state
}

export function clearOrgSettingsCache() {
  _cache = null; _cacheTime = 0
}
