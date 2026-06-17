'use client'

import { useState, useEffect } from 'react'

interface Template {
  name: string
  items: string[]
}

interface ChecklistTemplatesProps {
  orgId: string
  subtasks: { title: string }[]
  onApply: (titles: string[]) => void
}

export default function ChecklistTemplates({ orgId, subtasks, onApply }: ChecklistTemplatesProps) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  const storageKey = `upfloat_checklist_tpl_${orgId}`

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
      setTemplates(stored)
    } catch {
      setTemplates([])
    }
  }, [storageKey])

  function saveTemplates(updated: Template[]) {
    setTemplates(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  function handleSave() {
    const name = saveName.trim()
    if (!name || subtasks.length === 0) return
    const items = subtasks.map(s => s.title)
    const updated = [...templates.filter(t => t.name !== name), { name, items }]
    saveTemplates(updated)
    setSaveName('')
    setShowSaveInput(false)
  }

  function handleDelete(name: string) {
    saveTemplates(templates.filter(t => t.name !== name))
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          background: '#f9fafb',
          color: '#374151',
          cursor: 'pointer',
        }}
      >
        Apply checklist template ▾
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 200,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            minWidth: 260,
            padding: '8px 0',
            marginTop: 4,
          }}
        >
          {templates.length === 0 && !showSaveInput && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>
              No saved templates — save your current subtasks to create one
            </div>
          )}

          {templates.map(tpl => (
            <div
              key={tpl.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 14px',
                gap: 8,
              }}
            >
              <button
                onClick={() => { onApply(tpl.items); setOpen(false) }}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#111827',
                  padding: 0,
                }}
              >
                {tpl.name}
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                  ({tpl.items.length} items)
                </span>
              </button>
              <button
                onClick={() => handleDelete(tpl.name)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: '#ef4444',
                  padding: '0 2px',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 4, paddingTop: 4 }}>
            {!showSaveInput ? (
              <button
                onClick={() => setShowSaveInput(true)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#0d9488',
                  padding: '7px 14px',
                }}
              >
                + Save current subtasks as template
              </button>
            ) : (
              <div style={{ padding: '8px 14px', display: 'flex', gap: 6 }}>
                <input
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false) }}
                  placeholder="Template name"
                  style={{
                    flex: 1,
                    fontSize: 12,
                    padding: '4px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: 5,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSave}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 5,
                    border: 'none',
                    background: '#0d9488',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
