'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import MsmeWalkthrough from './MsmeWalkthrough'
import MsmeTour        from './MsmeTour'
import * as XLSX from 'xlsx'
import { MSME_PACKS } from '@/lib/msme/packs'
import { createClient } from '@/lib/supabase/client'

const ACCENT = '#0d9488'

interface Vendor {
  id: string
  vendor_name: string
  vendor_email: string
  gstin: string | null
  pan: string | null
  status: 'pending' | 'emailed' | 'submitted' | 'not_msme'
  payment_status: 'free' | 'unpaid' | 'paid'
  udyam_number: string | null
  udyam_registered_on: string | null
  msme_category: 'micro' | 'small' | 'medium' | null
  nature_of_business: 'manufacturer' | 'service_provider' | 'trader' | null
  outstanding_amount: number | null
  cert_url: string | null
  is_not_msme: boolean
  declarant_name: string | null
  declared_at: string | null
  submitted_at: string | null
  email_count: number
  last_emailed_at: string | null
  is_paid: boolean
  created_at: string
}

const STATUS_LABEL: Record<Vendor['status'], string> = {
  pending:   'Not contacted',
  emailed:   'Awaited reply',
  submitted: 'Submitted ✓',
  not_msme:  'Non-MSME ✓',
}
const STATUS_COLOR: Record<Vendor['status'], { bg: string; text: string }> = {
  pending:   { bg: '#f1f5f9', text: '#64748b' },
  emailed:   { bg: '#fff7ed', text: '#ea580c' },
  submitted: { bg: '#f0fdf4', text: '#16a34a' },
  not_msme:  { bg: '#f0f9ff', text: '#0284c7' },
}
const CAT_LABEL: Record<string, string>  = { micro: 'Micro', small: 'Small', medium: 'Medium' }
const NAT_LABEL: Record<string, string>  = { manufacturer: 'Manufacturer', service_provider: 'Service Provider', trader: 'Trader' }

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }
interface ImportRow { vendor_name: string; vendor_email: string; gstin?: string }

interface Props { userRole: string; orgName?: string }

export function MsmeView({ userRole, orgName }: Props) {
  const [vendors,       setVendors]       = useState<Vendor[]>([])
  const [total,         setTotal]         = useState(0)
  const [totalEver,     setTotalEver]     = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [vendorLimit,   setVendorLimit]   = useState<number>(5)
  const [packTier,      setPackTier]      = useState<string>('free')
  const [showUpgrade,   setShowUpgrade]   = useState(false)
  const [upgradeBusy,   setUpgradeBusy]   = useState<string | null>(null)
  const [shootingId,    setShootingId]    = useState<string | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [filterStatus,  setFilterStatus]  = useState<string>('all')
  const [search,        setSearch]        = useState('')
  const [toasts,        setToasts]        = useState<Toast[]>([])
  const [showTour,      setShowTour]      = useState(false)
  const [copyingId,     setCopyingId]     = useState<string | null>(null)
  const [exporting,     setExporting]     = useState(false)
  const [editingEmail,  setEditingEmail]  = useState<string | null>(null)
  const [editEmailVal,  setEditEmailVal]  = useState('')
  const [savingEmail,   setSavingEmail]   = useState(false)
  const [checkedIds,    setCheckedIds]    = useState<Set<string>>(new Set())
  const [bulkShooting,  setBulkShooting]  = useState(false)
  const toastRef = useRef(0)

  // Add vendor form
  const [vendorName,  setVendorName]  = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [gstin,       setGstin]       = useState('')
  const [addError,    setAddError]    = useState<string | null>(null)
  const [adding,      setAdding]      = useState(false)

  // Import state
  const [importRows,    setImportRows]    = useState<ImportRow[]>([])
  const [importPreview, setImportPreview] = useState<ImportRow[]>([])
  const [importError,   setImportError]   = useState<string | null>(null)
  const [importing,     setImporting]     = useState(false)
  const [importResult,  setImportResult]  = useState<{ inserted: number; skipped: Array<{row:number;name:string;reason:string}>; paid_slots: number } | null>(null)

  const canManage  = ['owner', 'admin', 'manager'].includes(userRole)
  const canAdmin   = ['owner', 'admin'].includes(userRole)

  // Derive current pack label and whether a higher pack is available
  const currentPack   = MSME_PACKS.find(p => p.tier === packTier)
  const packLabel     = currentPack?.label ?? 'Free'
  const highestTier   = MSME_PACKS[MSME_PACKS.length - 1].tier
  const canUpgrade    = packTier !== highestTier

  // A vendor is "unlocked" if it has already been emailed (slot consumed) OR if there are
  // still free email slots available. Locking is based on email slots, not import order.
  const unlockedIds = useMemo(() => {
    const canEmailMore = totalEver < vendorLimit
    return new Set(vendors.filter(v => v.email_count > 0 || canEmailMore).map(v => v.id))
  }, [vendors, vendorLimit, totalEver])

  // ── Email schedule config ──────────────────────────────────────────────────
  // intervalDays[i] = days to wait after email i before sending email i+1
  // e.g. [7,14,21,30] means 5 total emails: immediate + after 7, 14, 21, 30 days
  const [intervalDays,    setIntervalDays]    = useState<number[]>([7, 14, 21, 30])
  const maxEmails  = intervalDays.length + 1
  const [showSettings,    setShowSettings]    = useState(false)
  const [draftIntervals,  setDraftIntervals]  = useState<number[]>([7, 14, 21, 30])
  const [savingSchedule,  setSavingSchedule]  = useState(false)
  const [ccEmail,         setCcEmail]         = useState<string>('')
  const [draftCcEmail,    setDraftCcEmail]    = useState<string>('')

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = ++toastRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/msme/vendors')
      const data = await res.json()
      if (res.ok) {
        setVendors(data.vendors ?? [])
        setTotal(data.total ?? 0)
        setTotalEver(data.totalEver ?? data.total ?? 0)
        if (data.vendorLimit) setVendorLimit(data.vendorLimit)
      }
    } catch (e) {
      console.error('[MsmeView] fetchVendors failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  // If user returns to the page after payment (fallback), refresh pack settings
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('pack_upgraded') === '1') {
      fetch('/api/msme/settings')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.pack?.tier) setPackTier(d.pack.tier)
          if (d?.pack?.vendor_limit) setVendorLimit(d.pack.vendor_limit)
        })
        .catch(() => {})
      // Clean up the URL param without a full reload
      const url = new URL(window.location.href)
      url.searchParams.delete('pack_upgraded')
      window.history.replaceState({}, '', url.toString())
      showToast('Payment received — your pack is now active!', 'success')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch email schedule + pack tier + cc_email for this org
  useEffect(() => {
    fetch('/api/msme/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.schedule && Array.isArray(d.schedule)) {
          setIntervalDays(d.schedule)
          setDraftIntervals(d.schedule)
        }
        if (d?.pack?.tier) setPackTier(d.pack.tier)
        const cc = d?.cc_email ?? ''
        setCcEmail(cc)
        setDraftCcEmail(cc)
      })
      .catch(() => {})
  }, [])

  // ── Save email schedule + cc_email ───────────────────────────────────────
  async function handleSaveSchedule() {
    if (draftCcEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftCcEmail)) {
      showToast('Enter a valid CC email address', 'error'); return
    }
    setSavingSchedule(true)
    const res  = await fetch('/api/msme/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: draftIntervals, cc_email: draftCcEmail || null }),
    })
    setSavingSchedule(false)
    if (!res.ok) { const d = await res.json(); showToast(d.error ?? 'Failed to save', 'error'); return }
    setIntervalDays(draftIntervals)
    setCcEmail(draftCcEmail)
    setShowSettings(false)
    showToast('Settings saved')
  }


  // ── Upgrade pack ──────────────────────────────────────────────────────────
  async function handleUpgrade(tier: string) {
    setUpgradeBusy(tier)
    const res  = await fetch('/api/msme/pay', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pack_tier: tier }),
    })
    const data = await res.json()
    setUpgradeBusy(null)

    if (!res.ok) {
      if (res.status === 503) {
        showToast('Payment gateway not yet configured. Contact support to upgrade.', 'info')
      } else {
        showToast(data.error ?? data.message ?? 'Failed to initiate payment', 'error')
      }
      return
    }

    if (data.gateway === 'razorpay' && data.order_id) {
      setShowUpgrade(false)
      // Load Razorpay checkout script dynamically
      const loadRzp = () => new Promise<void>((resolve, reject) => {
        if ((window as any).Razorpay) { resolve(); return }
        const s = document.createElement('script')
        s.src = 'https://checkout.razorpay.com/v1/checkout.js'
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('Failed to load Razorpay'))
        document.body.appendChild(s)
      })
      try {
        await loadRzp()
        const rzp = new (window as any).Razorpay({
          key:         data.key_id,
          order_id:    data.order_id,
          amount:      data.amount,
          currency:    'INR',
          name:        'upFloat',
          description: `MSME Tracker — ${data.pack_tier} pack`,
          image:       '/favicon.svg',
          prefill: { email: data.email, name: data.org_name },
          theme: { color: '#0d9488' },
          handler: async (response: any) => {
            // Verify signature server-side
            const verifyRes = await fetch('/api/msme/pay', {
              method:  'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pack_tier:             data.pack_tier,
                razorpay_order_id:    response.razorpay_order_id,
                razorpay_payment_id:  response.razorpay_payment_id,
                razorpay_signature:   response.razorpay_signature,
              }),
            })
            const verifyData = await verifyRes.json()
            if (!verifyRes.ok) {
              showToast(verifyData.error ?? 'Payment verification failed', 'error')
              return
            }
            setPackTier(data.pack_tier)
            setVendorLimit(verifyData.vendor_limit ?? vendorLimit)
            showToast('Payment successful — your pack is now active! 🎉', 'success')
          },
          modal: {
            ondismiss: () => showToast('Payment cancelled', 'info'),
          },
        })
        rzp.open()
      } catch {
        showToast('Failed to open payment window. Please try again.', 'error')
      }
      return
    }

  }

  // ── Add single vendor ──────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAdding(true)
    const res  = await fetch('/api/msme/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_name: vendorName, vendor_email: vendorEmail, gstin }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setAddError(data.error ?? 'Failed to add vendor'); return }
    setShowAdd(false)
    setVendorName(''); setVendorEmail(''); setGstin('')
    showToast(`${vendorName} added successfully`)
    fetchVendors()
  }

  // ── Shoot email ────────────────────────────────────────────────────────────
  async function handleShootEmail(vendorId: string, vendorName: string) {
    setShootingId(vendorId)
    const res  = await fetch(`/api/msme/vendors/${vendorId}/shoot-email`, { method: 'POST' })
    const data = await res.json()
    setShootingId(null)
    if (!res.ok) { showToast(data.error ?? 'Failed to send email', 'error'); return }
    showToast(`Email sent to ${vendorName} (attempt ${data.attempt}/${intervalDays.length + 1})`)
    fetchVendors()
  }

  // ── Bulk shoot email ──────────────────────────────────────────────────────
  async function handleBulkShoot() {
    // Only shoot to unlocked vendors — never send to locked ones
    const ids = Array.from(checkedIds).filter(id => unlockedIds.has(id))
    if (ids.length === 0) return
    setBulkShooting(true)
    let sent = 0, failed = 0
    for (const id of ids) {
      const res  = await fetch(`/api/msme/vendors/${id}/shoot-email`, { method: 'POST' })
      if (!res.ok) { failed++; continue }
      sent++
    }
    setBulkShooting(false)
    setCheckedIds(new Set())
    const parts: string[] = []
    if (sent)   parts.push(`${sent} email${sent > 1 ? 's' : ''} sent`)
    if (failed) parts.push(`${failed} failed`)
    showToast(parts.join(' · '), failed > 0 ? 'info' : 'success')
    fetchVendors()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(vendorId: string) {
    if (!confirm('Remove this vendor? This cannot be undone.')) return
    setDeletingId(vendorId)
    const res = await fetch(`/api/msme/vendors/${vendorId}`, { method: 'DELETE' })
    setDeletingId(null)
    if (!res.ok) { showToast('Failed to remove vendor', 'error'); return }
    setSelectedId(null)
    showToast('Vendor removed')
    fetchVendors()
  }

  // ── Copy link ──────────────────────────────────────────────────────────────
  async function handleCopyLink(vendorId: string) {
    setCopyingId(vendorId)
    const res  = await fetch(`/api/msme/vendors/${vendorId}/shoot-email`, { method: 'POST', headers: { 'x-copy-only': '1' } })
    const data = await res.json()
    setCopyingId(null)
    if (!res.ok) { showToast(data.error ?? 'Could not generate link', 'error'); return }
    await navigator.clipboard.writeText(data.formUrl)
    showToast('Form link copied — paste in WhatsApp or SMS')
  }

  // ── Edit email ─────────────────────────────────────────────────────────────
  async function handleSaveEmail(vendorId: string) {
    if (!editEmailVal.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmailVal)) {
      showToast('Enter a valid email address', 'error'); return
    }
    setSavingEmail(true)
    const res = await fetch(`/api/msme/vendors/${vendorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_email: editEmailVal.trim().toLowerCase() }),
    })
    setSavingEmail(false)
    if (!res.ok) { showToast('Failed to update email', 'error'); return }
    setEditingEmail(null)
    showToast('Email updated')
    fetchVendors()
  }

  // ── Excel/CSV import ───────────────────────────────────────────────────────
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data   = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb     = XLSX.read(data, { type: 'array' })
        const sheet  = wb.Sheets[wb.SheetNames[0]]
        const raw    = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        if (raw.length === 0) { setImportError('No rows found in file'); return }

        // Normalise column names — accept variations like "Vendor Name", "Name", "VENDOR_NAME"
        const normalise = (key: string) => key.toLowerCase().replace(/[\s_-]/g, '')
        const rows: ImportRow[] = raw.map(row => {
          const entries = Object.entries(row)
          const find = (target: string) => entries.find(([k]) => normalise(k) === target)?.[1]?.toString().trim() ?? ''
          return {
            vendor_name:  find('vendorname') || find('name') || find('company') || find('companyname') || '',
            vendor_email: find('vendoremail') || find('email') || find('emailid') || find('emailaddress') || '',
            gstin:        find('gstin') || find('gst') || undefined,
          }
        }).filter(r => r.vendor_name || r.vendor_email)

        if (rows.length === 0) {
          setImportError('Could not find "Vendor Name" or "Email" columns. Check the template format.')
          return
        }
        setImportRows(rows)
        setImportPreview(rows.slice(0, 5))
      } catch {
        setImportError('Could not read file. Please use the Excel/CSV template provided.')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function handleImportSubmit() {
    setImporting(true)
    setImportError(null)
    const res  = await fetch('/api/msme/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: importRows }),
    })
    const data = await res.json()
    setImporting(false)
    if (!res.ok) { setImportError(data.error ?? 'Import failed'); return }
    setImportResult(data)
    fetchVendors()
  }

  function handleDownloadTemplate() {
    const ws  = XLSX.utils.aoa_to_sheet([
      ['Vendor Name', 'Vendor Email', 'GSTIN (optional)'],
      ['Shree Steel Works', 'contact@shreesteel.com', '27AABCU9603R1ZX'],
      ['ABC Services Pvt Ltd', 'accounts@abcservices.in', ''],
    ])
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors')
    XLSX.writeFile(wb, 'msme-vendor-import-template.xlsx')
  }

  // ── Export audit log: vendor data + email history merged ─────────────────
  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      // Fetch email logs first
      let logs: Array<{ vendor_id: string; attempt_no: number; sent_at: string; opened_at: string | null }> = []
      try {
        const logsRes = await fetch('/api/msme/email-logs')
        if (logsRes.ok) {
          const d = await logsRes.json()
          if (Array.isArray(d.logs)) logs = d.logs
        }
      } catch { /* best-effort */ }

      // Build a map: vendor_id → email log rows
      const logsByVendor = new Map<string, typeof logs>()
      for (const log of logs) {
        if (!logsByVendor.has(log.vendor_id)) logsByVendor.set(log.vendor_id, [])
        logsByVendor.get(log.vendor_id)!.push(log)
      }

      // Single merged sheet: one row per email sent (vendors with no emails get one row)
      const header = [
        'Vendor Name', 'Vendor Email', 'GSTIN', 'Current Status',
        'Udyam Number', 'Category', 'Nature of Business', 'Outstanding Amount (₹)',
        'Email # (of Total)', 'Email Sent On', 'Email Sent At', 'Email Opened On',
        'Submitted On', 'Declaration By', 'Date Added',
      ]

      const mergedRows: (string | number)[][] = []
      for (const v of vendors) {
        const vendorLogs = logsByVendor.get(v.id) ?? []
        const status = v.is_not_msme ? 'Non-MSME Declaration' : STATUS_LABEL[v.status].replace(' ✓', '')

        if (vendorLogs.length === 0) {
          // Vendor added but never emailed
          mergedRows.push([
            v.vendor_name, v.vendor_email, v.gstin ?? '', status,
            v.udyam_number ?? '', v.msme_category ? CAT_LABEL[v.msme_category] : '',
            v.nature_of_business ? NAT_LABEL[v.nature_of_business] : '',
            v.outstanding_amount !== null && v.outstanding_amount !== undefined ? v.outstanding_amount : '',
            '—', '—', '—', '—',
            v.submitted_at ? new Date(v.submitted_at).toLocaleDateString('en-IN') : '',
            v.declarant_name ?? '',
            new Date(v.created_at).toLocaleDateString('en-IN'),
          ])
        } else {
          for (const log of vendorLogs) {
            const sentDate = new Date(log.sent_at)
            mergedRows.push([
              v.vendor_name, v.vendor_email, v.gstin ?? '', status,
              v.udyam_number ?? '', v.msme_category ? CAT_LABEL[v.msme_category] : '',
              v.nature_of_business ? NAT_LABEL[v.nature_of_business] : '',
              v.outstanding_amount !== null && v.outstanding_amount !== undefined ? v.outstanding_amount : '',
              `${log.attempt_no} / ${maxEmails}`,
              sentDate.toLocaleDateString('en-IN'),
              sentDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
              log.opened_at ? new Date(log.opened_at).toLocaleDateString('en-IN') : 'Not opened',
              v.submitted_at ? new Date(v.submitted_at).toLocaleDateString('en-IN') : '',
              v.declarant_name ?? '',
              new Date(v.created_at).toLocaleDateString('en-IN'),
            ])
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet([header, ...mergedRows])
      ws['!cols'] = header.map(() => ({ wch: 22 }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'MSME Audit Log')

      XLSX.writeFile(wb, `msme-audit-log-${new Date().toISOString().slice(0,10)}.xlsx`)
      showToast(`Exported audit log — ${vendors.length} vendors, ${logs.length} email records`)
    } finally {
      setExporting(false)
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const selected       = vendors.find(v => v.id === selectedId) ?? null
  const searched       = vendors.filter(v =>
    !search ||
    v.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_email.toLowerCase().includes(search.toLowerCase()) ||
    (v.gstin ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const filtered = (filterStatus === 'all' ? searched : searched.filter(v => v.status === filterStatus))
    .slice()
    .sort((a, b) => {
      const aLocked = !unlockedIds.has(a.id)
      const bLocked = !unlockedIds.has(b.id)
      if (aLocked !== bLocked) return aLocked ? 1 : -1  // unlocked first, locked last
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

  const completedCount  = vendors.filter(v => v.status === 'submitted' || v.status === 'not_msme').length
  const exhaustedCount  = vendors.filter(v => v.email_count >= maxEmails && v.status === 'emailed').length
  const completionPct   = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const counts = {
    pending:  vendors.filter(v => v.status === 'pending').length,
    emailed:  vendors.filter(v => v.status === 'emailed').length,
    submitted:vendors.filter(v => v.status === 'submitted').length,
    not_msme: vendors.filter(v => v.status === 'not_msme').length,
  }

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: 'linear-gradient(180deg, rgba(13,148,136,0.04) 0%, transparent 200px)', colorScheme: 'light' }}>
    {/* Teal accent strip */}
    <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, #14b8a6, ${ACCENT})` }} />
    <div style={{ padding: '24px', maxWidth: 1120, margin: '0 auto' }}>

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#dc2626' : t.type === 'info' ? '#0284c7' : '#0f172a',
            color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxWidth: 320,
          }}>
            {t.type === 'error' ? '⚠ ' : t.type === 'info' ? 'ℹ ' : '✓ '}{t.message}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div data-tour="msme-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: ACCENT, letterSpacing: '-0.3px' }}>
              MSME Vendor Tracker
            </h1>
            <span style={{ fontSize: 11, fontWeight: 700, background: packTier === 'free' ? '#f1f5f9' : `${ACCENT}18`, color: packTier === 'free' ? '#64748b' : ACCENT, padding: '3px 10px', borderRadius: 20, border: `1px solid ${packTier === 'free' ? '#e2e8f0' : `${ACCENT}40`}` }}>
              {packLabel} Plan
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569', fontWeight: 500 }}>
            {totalEver}/{vendorLimit} email slots used
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {canAdmin && (
            <button data-tour="msme-upgrade-btn" onClick={() => setShowUpgrade(true)} style={{ ...ghostBtn, borderColor: ACCENT, color: ACCENT }}>
              {packTier === 'free' ? '↑ Upgrade Pack' : canUpgrade ? 'Buy Credits →' : `${packLabel} Plan`}
            </button>
          )}
          {canAdmin && (
            <button data-tour="msme-schedule-btn" onClick={() => { setShowSettings(true); setDraftIntervals([...intervalDays]); setDraftCcEmail(ccEmail) }} style={ghostBtn}>
              ⚙ Email schedule
            </button>
          )}
          {canManage && (
            <button data-tour="msme-import-btn" onClick={() => { setShowImport(true); setImportRows([]); setImportPreview([]); setImportResult(null); setImportError(null) }} style={ghostBtn}>
              ↑ Import Vendors
            </button>
          )}
          {vendors.length > 0 && (
            <button onClick={handleExport} disabled={exporting} style={{ ...ghostBtn, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'default' : 'pointer' }}>{exporting ? 'Exporting…' : '↓ Export Audit Log'}</button>
          )}
          {canManage && (
            <button data-tour="msme-add-btn" onClick={() => setShowAdd(true)} style={primaryBtn}>+ Add vendor</button>
          )}
        </div>
      </div>

      {/* ── Getting started banner (shown when no vendors yet) ── */}
      {!loading && totalEver === 0 && (
        <div data-tour="msme-getting-started" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { step: '1', icon: '➕', title: 'Add your vendors', desc: 'Add vendors manually or bulk-import from Excel', onClick: () => setShowAdd(true) },
            { step: '2', icon: '✉️', title: 'Shoot emails', desc: 'One click sends a branded MSME verification email', onClick: () => { setShowImport(true); setImportRows([]); setImportPreview([]); setImportResult(null); setImportError(null) } },
            { step: '3', icon: '📋', title: 'Track responses', desc: 'Vendors fill the form — you see status in real time', onClick: () => setShowAdd(true) },
          ].map(s => (
            <div key={s.step} onClick={s.onClick} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ACCENT; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 12px ${ACCENT}18` }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT}15`, border: `1.5px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{s.title}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Vendor limit banner ── */}
      {totalEver >= vendorLimit && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: 14 }}>
              📦 Email limit reached ({totalEver}/{vendorLimit})
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#b45309' }}>
              Upgrade your pack to email more vendors.
            </p>
          </div>
          {canAdmin && canUpgrade && (
            <button onClick={() => setShowUpgrade(true)} style={{ ...primaryBtn, padding: '7px 16px', fontSize: 12 }}>Upgrade Pack →</button>
          )}
        </div>
      )}

      {/* ── Compliance progress banner ── */}
      {!loading && total > 0 && (() => {
        const emailedCount = vendors.filter(v => v.email_count > 0).length
        const pct = Math.round((completedCount / total) * 100)
        const emailPct = Math.round((emailedCount / total) * 100)

        const catchyLine = completedCount === total
          ? '🎉 All vendors have responded — you\'re fully compliant!'
          : completedCount === 0 && emailedCount === 0
          ? 'Start by shooting emails — one click sends a branded verification request.'
          : completedCount === 0
          ? `${emailedCount} vendor${emailedCount > 1 ? 's' : ''} contacted. Waiting for responses — automated reminders are on the job.`
          : pct >= 75
          ? `Almost there! Just ${total - completedCount} more vendor${total - completedCount > 1 ? 's' : ''} to respond.`
          : pct >= 50
          ? `You're over halfway — ${completedCount} done, ${total - completedCount} more to go. Keep it up!`
          : pct >= 25
          ? `Good progress! ${completedCount} responded. Email the remaining ${total - completedCount} to stay on track.`
          : `${completedCount} responded so far. ${total - emailedCount > 0 ? `${total - emailedCount} vendor${total - emailedCount > 1 ? 's' : ''} still haven't been contacted.` : 'Hang tight — reminders are going out automatically.'}`

        return (
          <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '18px 22px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Compliance Progress</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {emailedCount > 0 && completedCount < total && (
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    <span style={{ fontWeight: 700, color: '#ea580c' }}>{emailedCount}</span> contacted
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>
                  {completedCount} / {total} responded
                </span>
              </div>
            </div>

            {/* Two-layer progress bar: emailed (amber) behind, completed (teal) in front */}
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 10, position: 'relative' }}>
              {/* emailed layer */}
              <div style={{ position: 'absolute', inset: 0, width: `${emailPct}%`, background: '#fed7aa', borderRadius: 99, transition: 'width 0.5s' }} />
              {/* completed layer */}
              <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT}, #14b8a6)`, borderRadius: 99, transition: 'width 0.5s' }} />
            </div>

            <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{catchyLine}</p>
          </div>
        )
      })()}

      {/* ── Summary cards ── */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <SummaryCard label="COMPLETION" value={`${completedCount}/${total}`} sub={`${completionPct}% responded`} accent={ACCENT} progress={completionPct} icon="✅" onClick={() => setFilterStatus(filterStatus === 'submitted' ? 'all' : 'submitted')} active={filterStatus === 'submitted'} />
          <SummaryCard label="NOT CONTACTED" value={String(counts.pending)} sub="awaiting first email" accent={counts.pending > 0 ? '#64748b' : ACCENT} icon="📭" onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')} active={filterStatus === 'pending'} />
          <SummaryCard label="AWAITED REPLY" value={String(counts.emailed)} sub="email sent, no response" accent={counts.emailed > 0 ? '#ea580c' : ACCENT} icon="⏳" onClick={() => setFilterStatus(filterStatus === 'emailed' ? 'all' : 'emailed')} active={filterStatus === 'emailed'} />
          {exhaustedCount > 0 && <SummaryCard label="MANUAL FOLLOW-UP" value={String(exhaustedCount)} sub={`${maxEmails} emails sent — call them`} accent="#dc2626" icon="📞" warn onClick={() => {}} active={false} />}
        </div>
      )}

      {/* ── Filters + search ── */}
      <div data-tour="msme-filters" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'pending', 'emailed', 'submitted', 'not_msme'] as const).map(s => {
          const count  = s === 'all' ? total : counts[s as keyof typeof counts] ?? 0
          const active = filterStatus === s
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${active ? ACCENT : '#e2e8f0'}`,
              background: active ? `${ACCENT}15` : '#ffffff',
              color: active ? ACCENT : '#64748b',
            }}>
              {s === 'all' ? 'All' : STATUS_LABEL[s as Vendor['status']].replace(' ✓', '')} · {count}
            </button>
          )
        })}
        <input
          style={{ marginLeft: 'auto', padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#ffffff', width: 220, outline: 'none', colorScheme: 'light' }}
          placeholder="Search name / email / GSTIN…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState search={search} onAdd={canManage ? () => setShowAdd(true) : undefined} onImport={canManage ? () => setShowImport(true) : undefined} />
          ) : (
            <div>
            {/* Bulk action bar */}
            {checkedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: `${ACCENT}12`, border: `1.5px solid ${ACCENT}40`, borderRadius: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{checkedIds.size} vendor{checkedIds.size > 1 ? 's' : ''} selected</span>
                <button
                  onClick={handleBulkShoot}
                  disabled={bulkShooting}
                  style={{ ...primaryBtn, padding: '7px 16px', fontSize: 13 }}
                >
                  {bulkShooting ? 'Sending…' : `✉ Shoot email to ${checkedIds.size} selected`}
                </button>
                <button onClick={() => setCheckedIds(new Set())} style={{ ...ghostBtn, padding: '7px 12px', fontSize: 12 }}>Clear</button>
              </div>
            )}

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: `${ACCENT}08`, borderBottom: `1.5px solid ${ACCENT}25` }}>
                    <th style={{ padding: '10px 14px', width: 36 }}>
                      <input
                        type="checkbox"
                        style={{ accentColor: ACCENT, cursor: 'pointer' }}
                        checked={checkedIds.size > 0 && filtered.filter(v => unlockedIds.has(v.id) && v.status !== 'submitted' && v.status !== 'not_msme' && v.email_count < maxEmails).every(v => checkedIds.has(v.id))}
                        onChange={e => {
                          const eligible = filtered.filter(v => unlockedIds.has(v.id) && v.status !== 'submitted' && v.status !== 'not_msme' && v.email_count < maxEmails)
                          if (e.target.checked) setCheckedIds(new Set(eligible.map(v => v.id)))
                          else setCheckedIds(new Set())
                        }}
                      />
                    </th>
                    {['Vendor', 'Status', 'Category', 'Emails', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap', fontSize: 12, letterSpacing: '0.03em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => {
                    const locked    = !unlockedIds.has(v.id)
                    const sc        = STATUS_COLOR[v.status]
                    const sel       = selectedId === v.id
                    const exhausted = v.email_count >= maxEmails && v.status === 'emailed'
                    const isEligible = v.status !== 'submitted' && v.status !== 'not_msme' && v.email_count < maxEmails

                    // Locked row — blurred content with upgrade CTA overlay
                    if (locked) {
                      return (
                        <tr key={v.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #e2e8f0' : undefined, background: '#f8fafc' }}>
                          <td colSpan={6} style={{ padding: 0, position: 'relative' }}>
                            {/* Blurred vendor info */}
                            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 14, filter: 'blur(3px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.5 }}>
                              <div style={{ width: 20, height: 20, borderRadius: 4, background: '#e2e8f0' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{v.vendor_name}</div>
                                <div style={{ color: '#64748b', fontSize: 11 }}>{v.vendor_email}</div>
                              </div>
                              <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                                {STATUS_LABEL[v.status]}
                              </span>
                            </div>
                            {/* Lock overlay */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>🔒 Locked</span>
                              <button
                                onClick={e => { e.stopPropagation(); setShowUpgrade(true) }}
                                style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Upgrade to unlock
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedId(sel ? null : v.id)}
                        style={{
                          borderBottom: i < filtered.length - 1 ? '1px solid #e2e8f0' : undefined,
                          background: checkedIds.has(v.id) ? `${ACCENT}08` : sel ? `${ACCENT}05` : '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '12px 14px', width: 36 }} onClick={e => e.stopPropagation()}>
                          {isEligible && (
                            <input
                              type="checkbox"
                              style={{ accentColor: ACCENT, cursor: 'pointer' }}
                              checked={checkedIds.has(v.id)}
                              onChange={e => {
                                const next = new Set(checkedIds)
                                if (e.target.checked) next.add(v.id)
                                else next.delete(v.id)
                                setCheckedIds(next)
                              }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{v.vendor_name}</div>
                              <div style={{ color: '#64748b', fontSize: 11 }}>{v.vendor_email}</div>
                              {v.gstin && <div style={{ color: '#64748b', fontSize: 11 }}>GSTIN: {v.gstin}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {exhausted ? (
                            <span style={{ background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                              ⚠ Needs call
                            </span>
                          ) : (
                            <span style={{ background: sc.bg, color: sc.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                              {STATUS_LABEL[v.status]}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>
                          {v.msme_category ? CAT_LABEL[v.msme_category] : v.is_not_msme ? 'Not MSME' : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: exhausted ? '#dc2626' : '#64748b', fontWeight: exhausted ? 700 : 400 }}>
                          {`${v.email_count}/${maxEmails}`}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {canManage && v.status !== 'submitted' && v.status !== 'not_msme' && v.email_count < maxEmails && (
                            <button
                              onClick={e => { e.stopPropagation(); handleShootEmail(v.id, v.vendor_name) }}
                              disabled={shootingId === v.id}
                              style={{ ...primaryBtn, padding: '5px 12px', fontSize: 11 }}
                            >
                              {shootingId === v.id ? 'Sending…' : v.email_count === 0 ? '✉ Shoot' : '✉ Re-shoot'}
                            </button>
                          )}
                          {(v.status === 'submitted' || v.status === 'not_msme') && (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Done</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div style={{ width: 300, flexShrink: 0, border: `1.5px solid ${ACCENT}40`, borderRadius: 10, overflow: 'hidden', background: '#ffffff', boxShadow: `0 0 0 3px ${ACCENT}10` }}>
            <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #14b8a6)`, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
                {selected.vendor_name}
              </span>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 16 }}>
              {/* Email with edit */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>EMAIL</span>
                {editingEmail === selected.id ? (
                  <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                    <input style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#0f172a', background: '#ffffff', outline: 'none' }}
                      value={editEmailVal} onChange={e => setEditEmailVal(e.target.value)} type="email" autoFocus />
                    <button onClick={() => handleSaveEmail(selected.id)} disabled={savingEmail} style={{ ...primaryBtn, padding: '6px 10px', fontSize: 11 }}>Save</button>
                    <button onClick={() => setEditingEmail(null)} style={{ ...ghostBtn, padding: '6px 8px', fontSize: 11 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 13, color: '#0f172a', wordBreak: 'break-all' }}>{selected.vendor_email}</span>
                    {selected.email_count === 0 && canManage && (
                      <button onClick={() => { setEditingEmail(selected.id); setEditEmailVal(selected.vendor_email) }}
                        style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>✎</button>
                    )}
                  </div>
                )}
              </div>

              {selected.gstin && <DetailRow label="GSTIN" value={selected.gstin} />}
              {selected.pan   && <DetailRow label="PAN"   value={selected.pan} />}

              {/* Status */}
              {(
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>STATUS</span>
                  <div style={{ marginTop: 3 }}>
                    {(() => {
                      const sc = STATUS_COLOR[selected.status]
                      const ex = selected.email_count >= maxEmails && selected.status === 'emailed'
                      return <span style={{ background: ex ? '#fef2f2' : sc.bg, color: ex ? '#dc2626' : sc.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {ex ? `⚠ ${maxEmails} emails sent — contact directly` : STATUS_LABEL[selected.status]}
                      </span>
                    })()}
                  </div>
                </div>
              )}

              {/* Submission details */}
              {selected.status === 'submitted' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  {selected.udyam_number       && <DetailRow label="Udyam No."        value={selected.udyam_number} />}
                  {selected.udyam_registered_on && <DetailRow label="Registered On"    value={new Date(selected.udyam_registered_on).toLocaleDateString('en-IN')} />}
                  {selected.msme_category      && <DetailRow label="Category"          value={CAT_LABEL[selected.msme_category]} />}
                  {selected.nature_of_business&& <DetailRow label="Nature"      value={NAT_LABEL[selected.nature_of_business]} />}
                  {selected.outstanding_amount !== null && selected.outstanding_amount !== undefined && (
                    <DetailRow label="Outstanding" value={`₹${Number(selected.outstanding_amount).toLocaleString('en-IN')}`} />
                  )}
                  {selected.submitted_at && <DetailRow label="Submitted" value={new Date(selected.submitted_at).toLocaleDateString('en-IN')} />}
                  {selected.cert_url && !selected.cert_url.startsWith('r2:') && (
                    <a href={selected.cert_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8, color: ACCENT, fontSize: 12, fontWeight: 600 }}>📎 Download certificate →</a>
                  )}
                  {selected.cert_url?.startsWith('r2:') && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Certificate in secure storage</p>}
                </div>
              )}

              {selected.status === 'not_msme' && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#0284c7' }}>NON-MSME DECLARATION</p>
                  {selected.declarant_name && <DetailRow label="Declared by" value={selected.declarant_name} />}
                  {selected.declared_at    && <DetailRow label="Date"        value={new Date(selected.declared_at).toLocaleDateString('en-IN')} />}
                </div>
              )}

              {selected.email_count > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, margin: '0 0 3px' }}>EMAIL HISTORY</p>
                  <p style={{ fontSize: 12, color: '#0f172a', margin: 0 }}>
                    {selected.email_count}/{maxEmails} sent · Last: {selected.last_emailed_at ? new Date(selected.last_emailed_at).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
              )}

              {/* Actions */}
              {canManage && selected.status !== 'submitted' && selected.status !== 'not_msme' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.email_count < maxEmails && (
                    <button onClick={() => handleShootEmail(selected.id, selected.vendor_name)} disabled={shootingId === selected.id} style={{ ...primaryBtn, width: '100%' }}>
                      {shootingId === selected.id ? 'Sending…' : selected.email_count === 0 ? '✉ Shoot email' : `✉ Re-shoot (${selected.email_count}/${maxEmails})`}
                    </button>
                  )}
                  <button onClick={() => handleCopyLink(selected.id)} disabled={copyingId === selected.id} style={{ ...ghostBtn, width: '100%' }}>
                    {copyingId === selected.id ? 'Generating…' : '🔗 Copy form link (WhatsApp / SMS)'}
                  </button>
                </div>
              )}

              {canAdmin && (
                <button onClick={() => handleDelete(selected.id)} disabled={deletingId === selected.id}
                  style={{ ...ghostBtn, width: '100%', marginTop: 10, color: '#dc2626', borderColor: '#fecaca', fontSize: 12 }}>
                  {deletingId === selected.id ? 'Removing…' : 'Remove vendor'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add vendor modal ── */}
      {showAdd && (
        <Modal title="Add vendor" onClose={() => { setShowAdd(false); setAddError(null) }}>
          <form onSubmit={handleAdd}>
            <Field label="Vendor / Company name *">
              <input style={mi} type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} required placeholder="e.g. Shree Steel Works" autoFocus />
            </Field>
            <Field label="Vendor email *" hint="Double-check — wrong email = vendor never gets the form">
              <input style={mi} type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} required placeholder="vendor@example.com" />
            </Field>
            <Field label="GSTIN (optional)">
              <input style={mi} type="text" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="27AABCU9603R1ZX" />
            </Field>
            {addError && <ErrorBox>{addError}</ErrorBox>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={adding} style={{ ...primaryBtn, flex: 1 }}>{adding ? 'Adding…' : 'Add vendor'}</button>
              <button type="button" onClick={() => { setShowAdd(false); setAddError(null) }} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Upgrade Pack modal ── */}
      {showUpgrade && (
        <Modal title={packTier === 'free' ? 'MSME Vendor Packs' : 'Buy More Credits'} onClose={() => setShowUpgrade(false)} wide>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
            {packTier === 'free'
              ? 'Choose a pack that fits your vendor base. All vendors within your pack limit get full access — automated emails, form links, and compliance tracking.'
              : `You're on the ${packLabel} plan (${vendorLimit} vendor slots). Purchase additional credits to email more vendors.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MSME_PACKS.filter(p => p.tier !== 'free').map(pack => {
              const isCurrent   = pack.tier === packTier
              // Downgrade = new pack has fewer slots than the current active pack limit
              const isDowngrade = pack.vendor_limit < vendorLimit
              // Warn (but don't block) when some vendors would remain locked after upgrade
              const lockedAfter = Math.max(0, totalEver - pack.vendor_limit)
              return (
                <div key={pack.tier} style={{
                  border: `2px solid ${isCurrent ? ACCENT : '#e2e8f0'}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: isCurrent ? `${ACCENT}08` : '#ffffff',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{pack.label}</span>
                      {isCurrent && <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: `${ACCENT}15`, padding: '2px 8px', borderRadius: 10 }}>Current</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      Up to <strong>{pack.vendor_limit} vendors</strong>
                    </div>
                    {!isCurrent && !isDowngrade && lockedAfter > 0 && (
                      <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
                        {lockedAfter} vendor{lockedAfter > 1 ? 's' : ''} will remain locked — upgrade to a larger pack to unlock all
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {pack.tier === 'pack_500' ? (
                      <>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>500+ vendors</div>
                        {!isCurrent && (
                          <a
                            href="mailto:info@upfloat.co?subject=MSME%20Enterprise%20Pack%20(500%20vendors)"
                            style={{ ...primaryBtn, marginTop: 4, padding: '6px 16px', fontSize: 12, textDecoration: 'none', display: 'inline-block' }}
                          >
                            Contact sales →
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        {pack.original_price_label && (
                          <div style={{ fontSize: 13, color: '#64748b', textDecoration: 'line-through' }}>{pack.original_price_label}</div>
                        )}
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{pack.price_label}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>one-time · + 18% GST</div>
                        {!isCurrent && !isDowngrade && (
                          <button
                            onClick={() => handleUpgrade(pack.tier)}
                            disabled={upgradeBusy === pack.tier}
                            style={{ ...primaryBtn, marginTop: 8, padding: '6px 16px', fontSize: 12 }}
                          >
                            {upgradeBusy === pack.tier ? 'Redirecting…' : packTier === 'free' ? 'Purchase →' : 'Buy Credits →'}
                          </button>
                        )}
                        {isDowngrade && !isCurrent && (
                          <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 8 }}>Contact support to downgrade</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 16, lineHeight: 1.5 }}>
            After payment, your pack activates instantly. Payment via UPI, net banking, or cards — powered by Razorpay.
          </p>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
            * 18% GST will be added at checkout. Your GST invoice will be issued after payment.
          </p>
        </Modal>
      )}

      {/* ── Email schedule settings modal ── */}
      {showSettings && (
        <Modal title="Automated email schedule" onClose={() => setShowSettings(false)}>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
            Configure when automated reminder emails are sent after the first email.
            You can set up to 5 emails total (email 1 is always sent immediately when you click "Shoot email").
          </p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 10 }}>
              Email sequence ({draftIntervals.length + 1} emails total)
            </div>

            {/* Email 1 row — always fixed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
              <div style={{ flex: 1, fontSize: 13, color: '#0f172a' }}>First email — sent immediately when you click "Shoot email"</div>
              <span style={{ fontSize: 12, color: '#64748b' }}>Day 0</span>
            </div>

            {/* Configurable follow-up rows */}
            {draftIntervals.map((days, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 2}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#0f172a' }}>
                  Reminder email {i + 2}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>After</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={e => {
                      const val = Math.max(1, Math.min(365, parseInt(e.target.value) || 1))
                      setDraftIntervals(prev => prev.map((d, idx) => idx === i ? val : d))
                    }}
                    style={{ width: 60, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, background: '#f8fafc', color: '#0f172a', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 12, color: '#64748b' }}>days</span>
                  {draftIntervals.length > 1 && (
                    <button
                      onClick={() => setDraftIntervals(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                      title="Remove this email"
                    >×</button>
                  )}
                </div>
              </div>
            ))}

            {/* Add email button */}
            {draftIntervals.length < 4 && (
              <button
                onClick={() => setDraftIntervals(prev => [...prev, 7])}
                style={{ width: '100%', padding: '8px', border: '1px dashed #e2e8f0', borderRadius: 8, background: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', marginTop: 4 }}
              >
                + Add another reminder email
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20, padding: '10px 14px', background: 'rgba(13,148,136,0.06)', borderRadius: 8 }}>
            💡 Tip: "After X days" means X days after the previous email in the sequence.
          </div>

          {/* CC email */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              CC email address <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span>
            </label>
            <input
              type="email"
              value={draftCcEmail}
              onChange={e => setDraftCcEmail(e.target.value)}
              placeholder="e.g. accounts@yourfirm.com"
              style={mi}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
              Every vendor email will be CC'd to this address. Leave blank to CC the org owner&apos;s email.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowSettings(false); setDraftCcEmail(ccEmail) }} style={ghostBtn}>Cancel</button>
            <button onClick={handleSaveSchedule} disabled={savingSchedule} style={{ ...primaryBtn, opacity: savingSchedule ? 0.7 : 1 }}>
              {savingSchedule ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Walkthrough + spotlight tour ── */}
      <MsmeWalkthrough onUpgrade={() => setShowUpgrade(true)} onStartTour={() => setShowTour(true)} />
      {showTour && <MsmeTour onDone={() => setShowTour(false)} />}

      {/* ── Import modal ── */}
      {showImport && (
        <Modal title="Import vendors from Excel / CSV" onClose={() => setShowImport(false)} wide>
          {!importResult ? (
            <>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
                Upload an Excel (.xlsx) or CSV file with columns: <strong>Vendor Name</strong> and <strong>Vendor Email</strong>.
                GSTIN column is optional. Duplicate emails are skipped automatically.
              </p>

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <label style={{ ...primaryBtn, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={{ display: 'none' }} />
                  ↑ Choose file
                </label>
                <button onClick={handleDownloadTemplate} style={ghostBtn}>
                  ↓ Download template
                </button>
              </div>

              {importError && <ErrorBox>{importError}</ErrorBox>}

              {importPreview.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: '0 0 10px' }}>
                    Preview — {importRows.length} rows found{importRows.length > 5 ? ` (showing first 5)` : ''}
                  </p>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Vendor Name', 'Email', 'GSTIN'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', color: r.vendor_name ? '#0f172a' : '#dc2626' }}>{r.vendor_name || '(missing)'}</td>
                            <td style={{ padding: '8px 12px', color: r.vendor_email ? '#0f172a' : '#dc2626' }}>{r.vendor_email || '(missing)'}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.gstin || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalEver >= vendorLimit && (
                    <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                      <strong>Heads up:</strong> You&apos;ve used all {vendorLimit} email slots. These vendors will be imported but you&apos;ll need to upgrade your pack before sending them emails.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={handleImportSubmit} disabled={importing} style={{ ...primaryBtn, flex: 1 }}>
                      {importing ? 'Importing…' : `Import ${importRows.length} vendors`}
                    </button>
                    <button onClick={() => { setImportRows([]); setImportPreview([]) }} style={{ ...ghostBtn, flex: 1 }}>Clear</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Import result */
            <div>
              <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 12 }}>{importResult.inserted > 0 ? '✅' : '⚠️'}</div>
              <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#0f172a', margin: '0 0 8px' }}>
                {importResult.inserted} vendor{importResult.inserted !== 1 ? 's' : ''} imported
              </p>
              {importResult.skipped.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{importResult.skipped.length} row{importResult.skipped.length !== 1 ? 's' : ''} skipped:</p>
                  {importResult.skipped.map((s, i) => (
                    <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#991b1b' }}>Row {s.row}: {s.name} — {s.reason}</p>
                  ))}
                </div>
              )}
              <button onClick={() => setShowImport(false)} style={{ ...primaryBtn, width: '100%' }}>Done</button>
            </div>
          )}
        </Modal>
      )}
    </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent, progress, warn, icon, onClick, active }: {
  label: string; value: string; sub: string; accent: string; progress?: number; warn?: boolean;
  icon?: string; onClick?: () => void; active?: boolean
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: warn ? '#fef2f2' : active ? `${accent}10` : '#ffffff',
        border: `1.5px solid ${warn ? '#fecaca' : active ? accent : '#e2e8f0'}`,
        borderTop: `3px solid ${warn ? '#ef4444' : accent}`,
        borderRadius: 12, padding: '16px 16px 14px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        boxShadow: active ? `0 2px 12px ${accent}25` : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: warn ? '#dc2626' : active ? accent : '#64748b', letterSpacing: '0.04em' }}>{label}</p>
        {icon && <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>}
      </div>
      <span style={{ fontSize: 26, fontWeight: 800, color: active ? accent : warn ? '#dc2626' : accent }}>{value}</span>
      {progress !== undefined && (
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, margin: '8px 0 4px' }}>
          <div style={{ height: 4, background: accent, borderRadius: 2, width: `${progress}%`, transition: 'width 0.4s' }} />
        </div>
      )}
      <p style={{ margin: progress !== undefined ? '2px 0 0' : '4px 0 0', fontSize: 11, color: warn ? '#dc2626' : active ? accent : '#64748b' }}>{sub}</p>
      {onClick && <p style={{ margin: '6px 0 0', fontSize: 10, color: active ? accent : '#64748b', fontWeight: 600 }}>{active ? 'Click to clear filter' : 'Click to filter'}</p>}
    </div>
  )
}

function EmptyState({ search, onAdd, onImport }: { search: string; onAdd?: () => void; onImport?: () => void }) {
  if (search) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b', border: '1.5px dashed #e2e8f0', borderRadius: 10 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
        <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>No vendors match your search</p>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>Try a different name, email, or GSTIN</p>
      </div>
    )
  }
  return (
    <div style={{ textAlign: 'center', padding: '56px 20px', background: `linear-gradient(135deg, ${ACCENT}05, transparent)`, border: `1.5px dashed ${ACCENT}40`, borderRadius: 12 }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🏭</div>
      <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>No vendors yet</p>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>Add your first MSME vendor to start tracking</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {onAdd    && <button onClick={onAdd}    style={primaryBtn}>+ Add vendor</button>}
        {onImport && <button onClick={onImport} style={ghostBtn}>↑ Import from Excel</button>}
      </div>
    </div>
  )
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#ffffff', borderRadius: 12, padding: 28, width: '100%', maxWidth: wide ? 560 : 420, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>{hint}</p>}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, gap: 8 }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
      <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{children as string}</p>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const mi: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, color: '#0f172a', background: '#ffffff', boxSizing: 'border-box', colorScheme: 'light',
}
