'use client'
import { useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Check, X, Search, Link2 } from 'lucide-react'

type Category = 'evergreen' | 'monthly' | 'quarterly' | 'annual'

interface DocType {
  id:                string
  name:              string
  category:          Category
  linked_task_types: string[]
  sort_order:        number
  is_active:         boolean
}

const CATEGORIES: { value: Category; label: string; emoji: string; description: string; color: string }[] = [
  { value: 'evergreen',  label: 'Permanent',  emoji: '♾️', description: 'Upload once, valid indefinitely', color: '#0d9488' },
  { value: 'monthly',   label: 'Monthly',    emoji: '📅', description: 'Required every month',           color: '#7c3aed' },
  { value: 'quarterly', label: 'Quarterly',  emoji: '🗓️', description: 'Required every quarter',         color: '#ca8a04' },
  { value: 'annual',    label: 'Annual',     emoji: '📆', description: 'Required once a year',           color: '#0891b2' },
]

interface Props {
  initialTypes:    DocType[]
  masterTaskNames: string[]
}

export function DocumentTypesForm({ initialTypes, masterTaskNames }: Props) {
  const [types,   setTypes]   = useState<DocType[]>(initialTypes)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [toast,   setToast]   = useState<string | null>(null)
  const [chipSearch, setChipSearch] = useState('')

  const blank = (): Partial<DocType> => ({
    name: '', category: 'monthly', linked_task_types: [], sort_order: types.length, is_active: true,
  })
  const [form, setForm] = useState<Partial<DocType>>(blank())

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function startAdd() {
    setForm(blank())
    setAdding(true)
    setEditId(null)
    setError(null)
    setChipSearch('')
  }

  function startEdit(dt: DocType) {
    setForm({ ...dt })
    setEditId(dt.id)
    setAdding(false)
    setError(null)
    setChipSearch('')
  }

  function cancelForm() {
    setAdding(false)
    setEditId(null)
    setError(null)
    setChipSearch('')
  }

  async function save() {
    if (!form.name?.trim()) { setError('Name is required'); return }
    if (!form.category)     { setError('Category is required'); return }
    setError(null)
    setSaving(true)
    try {
      if (adding) {
        const res  = await fetch('/api/settings/document-types', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed')
        setTypes(p => [...p, data.document_type])
        showToast('Document type added ✓')
      } else if (editId) {
        const res  = await fetch('/api/settings/document-types', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...form }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed')
        setTypes(p => p.map(t => t.id === editId ? data.document_type : t))
        showToast('Saved ✓')
      }
      cancelForm()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this document type? Existing uploads will not be affected.')) return
    const res = await fetch(`/api/settings/document-types?id=${id}`, { method: 'DELETE' })
    if (res.ok) { setTypes(p => p.filter(t => t.id !== id)); showToast('Deleted') }
    else setError('Failed to delete')
  }

  async function toggleActive(dt: DocType) {
    const res  = await fetch('/api/settings/document-types', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dt.id, is_active: !dt.is_active }),
    })
    const data = await res.json()
    if (res.ok) setTypes(p => p.map(t => t.id === dt.id ? data.document_type : t))
    else setError(data.error ?? 'Failed')
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

  // Chip list: filter by search, split into selected vs available
  const selectedLinks = form.linked_task_types ?? []
  const filteredChips = useMemo(() => {
    const q = chipSearch.toLowerCase().trim()
    return masterTaskNames.filter(n => !q || n.toLowerCase().includes(q))
  }, [masterTaskNames, chipSearch])
  const selectedVisible   = filteredChips.filter(n => selectedLinks.includes(n))
  const unselectedVisible = filteredChips.filter(n => !selectedLinks.includes(n))

  const isFormOpen = adding || !!editId
  const activeCat  = CATEGORIES.find(c => c.value === (form.category ?? 'monthly'))

  return (
    <div style={{ maxWidth: '760px', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Client Document Types
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          Define what documents clients must upload for compliance. The <strong>linked task types</strong> field
          auto-attaches uploads to the right tasks — no manual linking needed.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          background: '#0f172a', color: '#fff', fontSize: '13px', fontWeight: 500,
          padding: '10px 18px', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Check size={14} style={{ color: '#4ade80' }} /> {toast}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          fontSize: '13px', color: '#dc2626', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px',
          marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Add / Edit form ── */}
      {isFormOpen && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: '12px',
          marginBottom: '24px', background: 'var(--surface)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          {/* Form header */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface-subtle)',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {adding ? '+ New document type' : 'Edit document type'}
            </span>
            <button onClick={cancelForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {/* Name + Category row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '20px', alignItems: 'start' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Document name *
                </label>
                <input
                  autoFocus
                  value={form.name ?? ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="e.g. Bank Statement"
                  style={{
                    width: '100%', padding: '9px 12px', fontSize: '14px', fontWeight: 500,
                    border: '1.5px solid var(--border)', borderRadius: '8px',
                    background: 'var(--surface-subtle)', color: 'var(--text-primary)',
                    boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#0d9488')}
                  onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              {/* Category — pill selector */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Category *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {CATEGORIES.map(c => {
                    const active = form.category === c.value
                    return (
                      <button
                        key={c.value}
                        onClick={() => setForm(f => ({ ...f, category: c.value }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '7px',
                          padding: '6px 12px', borderRadius: '7px', cursor: 'pointer',
                          border: `1.5px solid ${active ? c.color : 'var(--border)'}`,
                          background: active ? `${c.color}14` : 'transparent',
                          color: active ? c.color : 'var(--text-muted)',
                          fontSize: '12px', fontWeight: active ? 700 : 400,
                          whiteSpace: 'nowrap', transition: 'all 0.1s',
                        }}>
                        <span>{c.emoji}</span> {c.label}
                        {active && <Check size={11} style={{ marginLeft: 'auto' }} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Linked task types */}
            {masterTaskNames.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Linked compliance tasks
                    <span style={{ fontWeight: 400, marginLeft: '6px', textTransform: 'none', letterSpacing: 0, fontSize: '12px' }}>
                      — auto-attach when client uploads
                    </span>
                  </label>
                  {selectedLinks.length > 0 && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color: '#0d9488',
                      background: 'rgba(13,148,136,0.1)', padding: '2px 8px', borderRadius: '20px',
                    }}>
                      {selectedLinks.length} selected
                    </span>
                  )}
                </div>

                {/* Search */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '8px',
                  background: 'var(--surface-subtle)', marginBottom: '10px',
                }}>
                  <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    value={chipSearch}
                    onChange={e => setChipSearch(e.target.value)}
                    placeholder={`Search ${masterTaskNames.length} task types…`}
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontSize: '13px', color: 'var(--text-primary)',
                    }}
                  />
                  {chipSearch && (
                    <button onClick={() => setChipSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Selected chips */}
                {selectedVisible.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#0d9488', fontWeight: 600, marginBottom: '5px' }}>
                      ✓ Selected
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {selectedVisible.map(name => (
                        <button
                          key={name}
                          onClick={() => toggleLinkedTask(name)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '12px', fontWeight: 600, padding: '4px 10px',
                            borderRadius: '20px', cursor: 'pointer',
                            border: '1.5px solid #0d9488', color: '#0d9488',
                            background: 'rgba(13,148,136,0.1)',
                          }}>
                          <Check size={10} /> {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                {selectedVisible.length > 0 && unselectedVisible.length > 0 && (
                  <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
                )}

                {/* Available chips */}
                {unselectedVisible.length > 0 && (
                  <div>
                    {selectedVisible.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '5px' }}>
                        Available
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '140px', overflowY: 'auto' }}>
                      {unselectedVisible.map(name => (
                        <button
                          key={name}
                          onClick={() => toggleLinkedTask(name)}
                          style={{
                            fontSize: '12px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                            border: '1px solid var(--border)', color: 'var(--text-muted)',
                            background: 'transparent',
                          }}>
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filteredChips.length === 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0' }}>
                    No task types match "{chipSearch}"
                  </p>
                )}

                {/* Quick actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={() => setForm(f => ({ ...f, linked_task_types: masterTaskNames }))}
                    style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>
                    Select all
                  </button>
                  {selectedLinks.length > 0 && (
                    <button
                      onClick={() => setForm(f => ({ ...f, linked_task_types: [] }))}
                      style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: '1px solid #fecaca', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Form actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', fontWeight: 600, color: '#fff',
                  background: saving ? '#6b7280' : '#0d9488',
                  border: 'none', borderRadius: '7px', padding: '9px 20px', cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                {saving ? 'Saving…' : adding ? <><Plus size={13} /> Add document type</> : <><Check size={13} /> Save changes</>}
              </button>
              <button
                onClick={cancelForm}
                style={{
                  fontSize: '13px', color: 'var(--text-muted)', background: 'none',
                  border: '1px solid var(--border)', borderRadius: '7px', padding: '9px 16px', cursor: 'pointer',
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document type list, grouped by category ── */}
      {CATEGORIES.map(cat => {
        const items = types.filter(t => t.category === cat.value)
        return (
          <div key={cat.value} style={{ marginBottom: '28px' }}>
            {/* Category header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px',
              paddingBottom: '8px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '15px' }}>{cat.emoji}</span>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
                  color: cat.color,
                }}>{cat.label}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  {cat.description}
                </span>
              </div>
              {items.length > 0 && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, color: cat.color,
                  background: `${cat.color}12`, padding: '2px 8px', borderRadius: '20px',
                }}>
                  {items.filter(i => i.is_active).length}/{items.length} active
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div style={{
                padding: '16px', borderRadius: '8px',
                border: `1.5px dashed ${cat.color}30`,
                background: `${cat.color}05`,
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  No {cat.label.toLowerCase()} document types yet.{' '}
                  {!isFormOpen && (
                    <button
                      onClick={() => { startAdd(); setForm(f => ({ ...f, category: cat.value })) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: cat.color, fontWeight: 600, fontSize: '13px', padding: 0 }}>
                      + Add one
                    </button>
                  )}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map(dt => (
                  <div key={dt.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '8px',
                    border: `1px solid ${editId === dt.id ? cat.color : 'var(--border)'}`,
                    background: editId === dt.id ? `${cat.color}06` : dt.is_active ? 'var(--surface)' : 'var(--surface-subtle)',
                    opacity: dt.is_active ? 1 : 0.55,
                    transition: 'all 0.15s',
                  }}>
                    {/* Left color stripe */}
                    <div style={{ width: '3px', height: '32px', borderRadius: '3px', background: cat.color, flexShrink: 0, opacity: dt.is_active ? 1 : 0.3 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {dt.name}
                        {!dt.is_active && (
                          <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '8px', background: 'var(--border)', padding: '1px 6px', borderRadius: '10px' }}>
                            inactive
                          </span>
                        )}
                      </div>
                      {dt.linked_task_types.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <Link2 size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {dt.linked_task_types.slice(0, 3).join(', ')}
                            {dt.linked_task_types.length > 3 && (
                              <span style={{ color: cat.color, fontWeight: 600 }}> +{dt.linked_task_types.length - 3} more</span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                          No linked task types
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                      <button
                        onClick={() => toggleActive(dt)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '5px', cursor: 'pointer',
                          color: dt.is_active ? '#16a34a' : 'var(--text-muted)',
                          background: dt.is_active ? 'rgba(22,163,74,0.08)' : 'transparent',
                          border: `1px solid ${dt.is_active ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`,
                          fontWeight: dt.is_active ? 600 : 400,
                        }}>
                        {dt.is_active ? '● Active' : '○ Inactive'}
                      </button>
                      <button
                        onClick={() => startEdit(dt)}
                        title="Edit"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '5px 10px', background: 'none', border: '1px solid var(--border)',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)',
                        }}>
                        <Pencil size={11} /> Edit
                      </button>
                      <button
                        onClick={() => remove(dt.id)}
                        title="Delete"
                        style={{
                          display: 'flex', alignItems: 'center',
                          padding: '5px 7px', background: 'none',
                          border: '1px solid transparent', borderRadius: '6px', cursor: 'pointer',
                        }}>
                        <Trash2 size={13} style={{ color: '#dc262660' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Add button */}
      {!isFormOpen && (
        <button
          onClick={startAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            fontSize: '13px', fontWeight: 600, color: '#0d9488',
            background: 'rgba(13,148,136,0.07)', border: '1.5px dashed rgba(13,148,136,0.4)',
            borderRadius: '9px', padding: '10px 20px', cursor: 'pointer',
          }}>
          <Plus size={15} /> Add document type
        </button>
      )}
    </div>
  )
}
