'use client'
import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, Printer } from 'lucide-react'

export function ReportsExport() {
  const [downloading, setDownloading] = useState<string|null>(null)

  async function downloadCSV(type: 'tasks' | 'time') {
    setDownloading(type)
    try {
      const res = await fetch('/api/reports/export?type=' + type)
      if (!res.ok) { alert('Export failed'); return }
      const blob    = await res.blob()
      const url     = URL.createObjectURL(blob)
      const a       = document.createElement('a')
      const date    = new Date().toISOString().split('T')[0]
      a.href        = url
      a.download    = type === 'tasks' ? 'planora-tasks-' + date + '.csv' : 'planora-time-' + date + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally { setDownloading(null) }
  }

  function printPDF() {
    // Hide everything except the charts area and add print styles
    const style = document.createElement('style')
    style.id    = 'print-styles'
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
    // Make the reports content printable
    const el = document.getElementById('reports-printable')
    if (el) el.style.display = 'block'
    window.print()
    // Cleanup after print dialog closes
    setTimeout(() => {
      const s = document.getElementById('print-styles')
      if (s) s.remove()
    }, 1000)
  }

  return (
    <div className="no-print flex items-center gap-2 flex-wrap">
      <button
        onClick={() => downloadCSV('tasks')}
        disabled={!!downloading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}>
        <FileSpreadsheet className="h-3.5 w-3.5"/>
        {downloading === 'tasks' ? 'Downloading…' : 'Tasks CSV'}
      </button>

      <button
        onClick={() => downloadCSV('time')}
        disabled={!!downloading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}>
        <FileSpreadsheet className="h-3.5 w-3.5"/>
        {downloading === 'time' ? 'Downloading…' : 'Time CSV'}
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
