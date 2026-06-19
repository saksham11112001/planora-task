'use client'
import { useState } from 'react'
import { FileSpreadsheet, Printer } from 'lucide-react'
import { toast, useFilterStore } from '@/store/appStore'

export function ReportsExport() {
  const [downloading, setDownloading] = useState<string|null>(null)
  const { assigneeId, clientId, priority, status, dueDateFrom, dueDateTo } = useFilterStore()

  async function downloadExcel(type: 'tasks' | 'time') {
    setDownloading(type)
    try {
      const params = new URLSearchParams({ type, format: 'xlsx' })
      assigneeId.forEach(id => params.append('assigneeId', id))
      clientId.forEach(id   => params.append('clientId',   id))
      priority.forEach(p    => params.append('priority',   p))
      status.forEach(s      => params.append('status',     s))
      if (dueDateFrom) params.set('dueDateFrom', dueDateFrom)
      if (dueDateTo)   params.set('dueDateTo',   dueDateTo)

      const res  = await fetch('/api/reports/export?' + params.toString())
      if (!res.ok) { toast.error('Export failed. Please try again.'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      a.href     = url
      a.download = type === 'tasks' ? `upfloat-tasks-${date}.xlsx` : `upfloat-time-${date}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(null) }
  }

  function printPDF() {
    const style     = document.createElement('style')
    style.id        = 'print-styles'
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        .app-shell { display: none !important; }
        #reports-printable { display: block !important; position: fixed; inset: 0; z-index: 99999; background: white; overflow: auto; }
        .no-print { display: none !important; }
        @page { margin: 1cm; size: A4 landscape; }
      }
    `
    document.head.appendChild(style)
    const el = document.getElementById('reports-printable')
    if (el) el.style.display = 'block'
    window.print()
    setTimeout(() => {
      const s = document.getElementById('print-styles')
      if (s) s.remove()
    }, 1000)
  }

  const hasFilters = assigneeId.length > 0 || clientId.length > 0 || priority.length > 0 ||
                     status.length > 0 || !!dueDateFrom || !!dueDateTo

  return (
    <div className="no-print flex items-center gap-2 flex-wrap">
      <button
        onClick={() => downloadExcel('tasks')}
        disabled={!!downloading}
        title={hasFilters ? 'Download filtered tasks as Excel' : 'Download all tasks (last 30 days) as Excel'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
        style={{ borderColor: hasFilters ? 'var(--brand)' : 'var(--border)', color: hasFilters ? 'var(--brand)' : 'var(--text-secondary)', background: hasFilters ? 'var(--brand-light)' : 'var(--surface)' }}>
        <FileSpreadsheet className="h-3.5 w-3.5"/>
        {downloading === 'tasks' ? 'Downloading…' : hasFilters ? 'Tasks Excel (filtered)' : 'Tasks Excel'}
      </button>

      <button
        onClick={() => downloadExcel('time')}
        disabled={!!downloading}
        title={hasFilters ? 'Download filtered time logs as Excel' : 'Download all time logs (last 30 days) as Excel'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
        style={{ borderColor: hasFilters ? 'var(--brand)' : 'var(--border)', color: hasFilters ? 'var(--brand)' : 'var(--text-secondary)', background: hasFilters ? 'var(--brand-light)' : 'var(--surface)' }}>
        <FileSpreadsheet className="h-3.5 w-3.5"/>
        {downloading === 'time' ? 'Downloading…' : hasFilters ? 'Time Excel (filtered)' : 'Time Excel'}
      </button>

      <button
        onClick={printPDF}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
        style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-light)' }}>
        <Printer className="h-3.5 w-3.5"/>
        Export PDF
      </button>
    </div>
  )
}
