'use client'
import { useState, useEffect } from 'react'

export interface FieldConfig { visible: boolean; mandatory: boolean }
export type TaskFields = Record<string, FieldConfig>

const DEFAULT_FIELDS: TaskFields = {
  assignee:        { visible: true, mandatory: false },
  due_date:        { visible: true, mandatory: false },
  priority:        { visible: true, mandatory: false },
  client:          { visible: true, mandatory: false },
  attachment:      { visible: true, mandatory: false },
  approver:        { visible: true, mandatory: false },
  description:     { visible: true, mandatory: false },
  estimated_hours: { visible: true, mandatory: false },
}

let _cache: TaskFields | null = null
let _cacheTime = 0
const TTL = 60_000

export function useTaskFields() {
  const [fields,  setFields]  = useState<TaskFields>(_cache ?? DEFAULT_FIELDS)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache && Date.now() - _cacheTime < TTL) { setFields(_cache); setLoading(false); return }
    fetch('/api/settings/fields')
      .then(r => r.json())
      .then(d => {
        const f: TaskFields = d.data ? { ...DEFAULT_FIELDS, ...d.data } : DEFAULT_FIELDS
        _cache = f; _cacheTime = Date.now(); setFields(f)
      })
      .catch(() => setFields(DEFAULT_FIELDS))
      .finally(() => setLoading(false))
  }, [])

  return {
    fields,
    loading,
    show: (key: string) => fields[key]?.visible !== false,
    required: (key: string) => fields[key]?.mandatory === true,
  }
}
