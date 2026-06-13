'use client'
import { useState, useEffect } from 'react'

const ACCENT = '#0d9488'

interface VendorInfo {
  vendor_id: string
  vendor_name: string
  org_name: string
  already_submitted: boolean
  already_declared: boolean
}

const CATEGORIES = [
  { value: 'micro',  label: 'Micro Enterprise' },
  { value: 'small',  label: 'Small Enterprise' },
  { value: 'medium', label: 'Medium Enterprise' },
]

const NATURE = [
  { value: 'manufacturer',    label: 'Manufacturer' },
  { value: 'service_provider',label: 'Service Provider' },
  { value: 'trader',          label: 'Trader' },
]

export function MsmeVendorForm({ token }: { token: string }) {
  const [loading,    setLoading]    = useState(true)
  const [info,       setInfo]       = useState<VendorInfo | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [submitted,  setSubmitted]  = useState(false)

  // form state
  const [isNotMsme,         setIsNotMsme]         = useState(false)
  const [declarantName,     setDeclarantName]     = useState('')
  const [udyamNumber,       setUdyamNumber]       = useState('')
  const [msmeCategory,      setMsmeCategory]      = useState('')
  const [natureOfBusiness,  setNatureOfBusiness]  = useState('')
  const [outstandingAmount, setOutstandingAmount] = useState('')
  const [certFile,          setCertFile]          = useState<File | null>(null)
  const [certUrl,           setCertUrl]           = useState<string | null>(null)
  const [uploading,         setUploading]         = useState(false)
  const [saving,            setSaving]            = useState(false)
  const [formError,         setFormError]         = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/msme/submit/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setInfo(d)
        if (d.already_submitted) setSubmitted(true)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load form. Please try again.'); setLoading(false) })
  }, [token])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFile(file)
    setUploading(true)
    setFormError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/msme/upload/${token}`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { setFormError(data.error ?? 'Upload failed'); setCertFile(null); return }
    setCertUrl(data.cert_url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!isNotMsme && !certUrl) {
      setFormError('Please upload your Udyam Registration Certificate before submitting.')
      return
    }

    setSaving(true)
    const payload = isNotMsme
      ? { is_not_msme: true, declarant_name: declarantName }
      : {
          is_not_msme: false,
          udyam_number: udyamNumber,
          msme_category: msmeCategory,
          nature_of_business: natureOfBusiness,
          outstanding_amount: outstandingAmount === '' ? null : outstandingAmount,
          cert_url: certUrl,
        }

    const res  = await fetch(`/api/msme/submit/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setFormError(data.error ?? 'Submission failed. Please try again.'); return }
    setSubmitted(true)
  }

  if (loading) return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>🔗</div>
        <h1 style={h1}>Link Expired or Invalid</h1>
        <p style={sub}>{error}</p>
        <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 24 }}>Powered by Floatup</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>✅</div>
        <h1 style={{ ...h1, textAlign: 'center' }}>Details submitted successfully</h1>
        <p style={{ ...sub, textAlign: 'center' }}>
          Thank you, {info?.vendor_name}. {info?.org_name} has been notified.
          You do not need to take any further action.
        </p>
        <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 32 }}>Powered by Floatup</p>
      </div>
    </div>
  )

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 560 }}>
        {/* Header */}
        <div style={{ background: '#0f172a', margin: '-32px -32px 28px', padding: '18px 28px', borderRadius: '12px 12px 0 0' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>⚡ {info?.org_name}</span>
        </div>

        <h1 style={{ ...h1, marginBottom: 6 }}>MSME Compliance Details</h1>
        <p style={{ ...sub, marginBottom: 24 }}>
          Hi {info?.vendor_name}, please fill in your MSME registration details below.
          This is required under the MSMED Act, 2006.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Toggle: not an MSME */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isNotMsme}
              onChange={e => setIsNotMsme(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: ACCENT, flexShrink: 0 }}
            />
            <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
              We are <strong>not registered as an MSME</strong> (Micro, Small, or Medium Enterprise).
              I want to submit a declaration instead.
            </span>
          </label>

          {isNotMsme ? (
            /* Non-MSME declaration */
            <div style={section}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
                By submitting this declaration, you confirm that your business is not registered under
                the Micro, Small and Medium Enterprises Development Act, 2006.
              </p>
              <div style={fieldGroup}>
                <label style={labelStyle}>Your full name (declarant) <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="e.g. Rajesh Kumar Sharma"
                  value={declarantName}
                  onChange={e => setDeclarantName(e.target.value)}
                  required={isNotMsme}
                />
              </div>
            </div>
          ) : (
            /* MSME details */
            <div>
              {/* Udyam Number */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Udyam Registration Number <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="UDYAM-MH-15-0012345"
                  value={udyamNumber}
                  onChange={e => setUdyamNumber(e.target.value.toUpperCase())}
                  required
                />
                <p style={hint}>Format: UDYAM-[State]-[District]-[7 digits]</p>
              </div>

              {/* MSME Category */}
              <div style={fieldGroup}>
                <label style={labelStyle}>MSME Category <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setMsmeCategory(c.value)}
                      style={{
                        padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `2px solid ${msmeCategory === c.value ? ACCENT : '#e2e8f0'}`,
                        background: msmeCategory === c.value ? `${ACCENT}15` : '#fff',
                        color: msmeCategory === c.value ? ACCENT : '#374151',
                      }}
                    >{c.label}</button>
                  ))}
                </div>
              </div>

              {/* Nature of business */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Nature of Business <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {NATURE.map(n => (
                    <button
                      key={n.value}
                      type="button"
                      onClick={() => setNatureOfBusiness(n.value)}
                      style={{
                        padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `2px solid ${natureOfBusiness === n.value ? ACCENT : '#e2e8f0'}`,
                        background: natureOfBusiness === n.value ? `${ACCENT}15` : '#fff',
                        color: natureOfBusiness === n.value ? ACCENT : '#374151',
                      }}
                    >{n.label}</button>
                  ))}
                </div>
              </div>

              {/* Outstanding amount */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Last outstanding amount as on 31st March (₹)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 125000"
                  value={outstandingAmount}
                  onChange={e => setOutstandingAmount(e.target.value)}
                />
                <p style={hint}>Enter 0 if no outstanding balance. Leave blank if not applicable.</p>
              </div>

              {/* Certificate upload */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Udyam Registration Certificate <span style={{ color: '#dc2626' }}>*</span></label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: `2px dashed ${certUrl ? ACCENT : '#e2e8f0'}`,
                  borderRadius: 8, padding: '14px 18px', cursor: 'pointer',
                  background: certUrl ? `${ACCENT}08` : '#fafafa',
                }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ display: 'none' }} />
                  {uploading
                    ? <span style={{ fontSize: 13, color: '#64748b' }}>Uploading…</span>
                    : certUrl
                    ? <span style={{ fontSize: 13, color: ACCENT, fontWeight: 600 }}>✓ {certFile?.name ?? 'Certificate uploaded'}</span>
                    : <span style={{ fontSize: 13, color: '#64748b' }}>Click to upload PDF, JPG or PNG (max 5 MB)</span>
                  }
                </label>
              </div>
            </div>
          )}

          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || uploading}
            style={{
              width: '100%', padding: '13px 0', background: saving ? '#94a3b8' : ACCENT,
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', marginTop: 8,
            }}
          >
            {saving ? 'Submitting…' : isNotMsme ? 'Submit Declaration' : 'Submit MSME Details'}
          </button>
        </form>

        <p style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
          Your information is shared only with {info?.org_name} for MSME compliance purposes.<br/>
          Powered by Floatup
        </p>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#f8fafc', display: 'flex',
  alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}
const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
  padding: 32, width: '100%', maxWidth: 560,
}
const h1: React.CSSProperties = { margin: '0 0 6px', color: '#0f172a', fontSize: 20, fontWeight: 700 }
const sub: React.CSSProperties = { color: '#64748b', fontSize: 14, margin: 0, lineHeight: 1.6 }
const section: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, marginBottom: 20 }
const fieldGroup: React.CSSProperties = { marginBottom: 20 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box',
}
const hint: React.CSSProperties = { fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }
