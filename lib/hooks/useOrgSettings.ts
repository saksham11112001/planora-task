'use client'
import { useState, useEffect } from 'react'
import type { CustomFieldDef } from '@/components/tasks/CustomFieldsPanel'
import type { TaskFields }     from '@/lib/hooks/useTaskFields'

interface OrgSettings {
  customFields: CustomFieldDef[]
  taskFields: TaskFields
  loading: boolean
}

const DEFAULT_TASK_FIELDS: TaskFields = {
  assignee: { visible: true, mandatory: false },
  due_date: { visible: true, mandatory: false },
  priority: { visible: true, mandatory: false },
  client:   { visible: true, mandatory: false },
  attachment: { visible: true, mandatory: false },
  approver:   { visible: true, mandatory: false },
  description:{ visible: true, mandatory: false },
  estimated_hours: { visible: true, mandatory: false },
}

let _cache: OrgSettings | null = null
let _cacheTime = 0
const TTL = 60_000

export function useOrgSettings(): OrgSettings {
  const [state, setState] = useState<OrgSettings>(
    _cache ?? { customFields: [], taskFields: DEFAULT_TASK_FIELDS, loading: true }
  )

  useEffect(() => {
    if (_cache && Date.now() - _cacheTime < TTL) { setState(_cache); return }
    Promise.all([
      fetch('/api/settings/custom-fields').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/settings/fields').then(r => r.json()).catch(() => ({ data: null })),
    ]).then(([customRes, fieldsRes]) => {
      const s: OrgSettings = {
        customFields: customRes.data ?? [],
        taskFields: fieldsRes.data
          ? { ...DEFAULT_TASK_FIELDS, ...fieldsRes.data }
          : DEFAULT_TASK_FIELDS,
        loading: false,
      }
      _cache = s; _cacheTime = Date.now()
      setState(s)
    })
  }, [])

  return state
}
