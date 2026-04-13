'use client'
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, GripVertical } from 'lucide-react'

type Category = 'evergreen' | 'monthly' | 'quarterly' | 'annual'

interface DocType {
  id:                string
  name:              string
  category:          Category
  linked_task_types: string[]
  sort_order:        number
  is_active:         boolean
}

const CATEGORIES: { value: Category; label: string; description: string }[] = [
  { value: 'evergreen',  label: 'Permanent',  description: 'Upload once (e.g. PAN, GST certificate)' },
  { value: 'monthly',   label: 'Monthly',    description: 'Required every month (e.g. Bank statement)' },
  { value: 'quarterly', label: 'Quarterly',  description: 'Required every quarter (e.g. ITR challan)' },
  { value: 'annual',    label: 'Annual',     description: 'Required once a year (e.g. Audit report)' },
]

const CATEGORY_COLORS: Record<Category, string> = {
  evergreen:  '#0d9488',
  monthly:    '#7c3aed',
  quarterly:  '#ca8a04',
  annual:     '#0891b2',
}

interface Props {
  initialTypes:    DocType[]
  masterTaskNames: string[]
}

export function DocumentTypesForm({ initialTypes, masterTaskNames }: Props) {
  const [types,   setTypes]   = useState<DocType[]>(initialTypes)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [adding,  setAdding]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // New / edit form state
  const blank = (): Partial<DocType> => ({ name: '', category: 'monthly', linked_task_types: [], sort_order: types.length, is_active: true })
  const [form, setForm] = useState<Partial<DocType>>(blank())

  function startAdd() {
    setForm(blank())
    setAdding(true)
    setEditId(null)
    setError(null)
  }

  function startEdit(dt: DocType) {
    setForm({ ...dt })
    setEditId(dt.id)
    setAdding(false)
    setError(null)
  }

  function cancelForm() {
    setAdding(false)
    setEditId(null)
    setError(null)
  }

  async function save() {
    if (!form.name?.trim()) { setError('Name is required'); return }
    if (!form.category)     { setError('Category is required'); return }
    setError(null)

    try {
      if (adding) {
        const res = await fetch('/api/settings/document-types', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed')
        setTypes(p => [...p, data.document_type])
        setSuccess('Document type added')
      } else if (editId) {
        const res = await fetch('/api/settings/document-types', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...form }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed')
        setTypes(p => p.map(t => t.id === editId ? data.document_type : t))
        setSuccess('Document type updated')
      }
      cancelForm()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this document type? Existing uploads will not be affected.')) return
    try {
      const res = await fetch(`/api/settings/document-types?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setTypes(p => p.filter(t => t.id !== id))
      setSuccess('Deleted')
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function toggleActive(dt: DocType) {
    try {
      const res = await fetch('/api/settings/document-types', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dt.id, is_active: !dt.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setTypes(p => p.map(t => t.id === dt.id ? data.document_type : t))
    } catch (e: any) {
      setError(e.message)
    }
  }

  function toggleLinkedTask(taskName: string) {
    setForm(f => {
      const cur = f.linked_task_types ?? []
      return {
        ...f,
        linked_task_types: cur.includes(taskName)
          ? cur.filter(t => t !== taskName)
          : [...cur, taskName],
      }
    })
  }

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: types.filter(t => t.category === cat.value),
  }))

  const isFormOpen = adding || !!editId

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Client Document Types
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
          Define the documents clients must upload for compliance tasks. These apply to all clients in your organisation.
        </p>
      </div>

      {success && (
        <div style={{ fontSize: '13px', color: '#16a34a', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Check size={14} /> {success}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Add / Edit form */}
      {isFormOpen && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '20px', background: 'var(--surface)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
            {adding ? 'Add document type' : 'Edit document type'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Name *
              </label>
              <input
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bank Statement"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface-subtle)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Category *
              </label>
              <select
                value={form.category ?? 'monthly'}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface-subtle)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} — {c.description}</option>)}
              </select>
            </div>
          </div>

          {masterTaskNames.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Linked compliance task types
                <span style={{ fontWeight: 400, marginLeft: '6px' }}>(auto-attach to these tasks when uploaded)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {masterTaskNames.map(name => {
                  const selected = (form.linked_task_types ?? []).includes(name)
                  return (
                    <button
                      key={name}
                      onClick={() => toggleLinkedTask(name)}
                      style={{
                        fontSize: '12px', fontWeight: selected ? 600 : 400,
                        padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                        border: `1px solid ${selected ? '#0d9488' : 'var(--border)'}`,
                        color: selected ? '#0d9488' : 'var(--text-muted)',
                        background: selected ? 'rgba(13,148,136,0.08)' : 'transparent',
                      }}>
                      {selected && '✓ '}{name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={save}
              style={{ fontSize: '13px', fontWeight: 600, color: '#fff', background: '#0d9488', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}>
              {adding ? 'Add' : 'Save changes'}
            </button>
            <button
              onClick={cancelForm}
              style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Document type groups */}
      {grouped.map(group => (
        <div key={group.value} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
              color: CATEGORY_COLORS[group.value], background: `${CATEGORY_COLORS[group.value]}15`,
              padding: '3px 8px', borderRadius: '20px',
            }}>{group.label}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{group.description}</span>
          </div>

          {group.items.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '10px 0 0', fontStyle: 'italic' }}>
              No {group.label.toLowerCase()} document types yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {group.items.map(dt => (
                <div key={dt.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px',
                  border: `1px solid var(--border)`,
                  background: dt.is_active ? 'var(--surface)' : 'var(--surface-subtle)',
                  opacity: dt.is_active ? 1 : 0.6,
                }}>
                  <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{dt.name}</div>
                    {dt.linked_task_types.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Linked to: {dt.linked_task_types.join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => toggleActive(dt)}
                      title={dt.is_active ? 'Deactivate' : 'Activate'}
                      style={{
                        fontSize: '11px', padding: '3px 8px', borderRadius: '4px',
                        color: dt.is_active ? '#16a34a' : 'var(--text-muted)',
                        background: dt.is_active ? 'rgba(22,163,74,0.08)' : 'transparent',
                        border: '1px solid var(--border)', cursor: 'pointer',
                      }}>
                      {dt.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => startEdit(dt)}
                      title="Edit"
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    <button
                      onClick={() => remove(dt.id)}
                      title="Delete"
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={12} style={{ color: '#dc2626' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {!isFormOpen && (
        <button
          onClick={startAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: 600, color: '#0d9488',
            background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
            borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', marginTop: '8px',
          }}>
          <Plus size={14} /> Add document type
        </button>
      )}
    </div>
  )
}
