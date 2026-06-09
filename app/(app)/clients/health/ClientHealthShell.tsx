'use client'
import { useState, useEffect, useCallback } from 'react'
import { ClientHealthView } from './ClientHealthView'

interface Props { canManage: boolean }

export function ClientHealthShell({ canManage }: Props) {
  const [clients, setClients]         = useState<any[]>([])
  const [overdueTasks, setOverdueTasks] = useState<any[]>([])
  const [invoices, setInvoices]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, tRes, iRes] = await Promise.all([
        fetch('/api/clients?limit=500').then(r => r.json()),
        fetch('/api/tasks?limit=2000').then(r => r.json()),
        fetch('/api/invoices?limit=500').then(r => r.json()),
      ])
      setClients(cRes.data ?? [])

      // Filter overdue open tasks client-side
      const allTasks: any[] = tRes.data ?? []
      const overdue = allTasks.filter((t: any) =>
        t.due_date && t.due_date < today &&
        !['completed', 'cancelled'].includes(t.status) &&
        !t.is_archived
      )
      setOverdueTasks(overdue)
      setInvoices((iRes.data ?? []).filter((i: any) =>
        ['sent', 'draft'].includes(i.status)
      ))
    } catch (e) {
      console.error('[ClientHealthShell]', e)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <ClientHealthView
      clients={clients}
      overdueTasks={overdueTasks}
      invoices={invoices}
      today={today}
      canManage={canManage}
    />
  )
}
