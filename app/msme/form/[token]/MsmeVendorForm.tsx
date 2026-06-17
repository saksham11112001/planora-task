'use client'
import { useState, useEffect } from 'react'

const ACCENT = '#0d9488'
const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/

interface VendorInfo {
  vendor_id: string
  vendor_name: string
  org_name: string
  already_submitted: boolean
  already_declared: boolean
  // submission details returned when already done
  udyam_number?: string | null
  msme_category?: string | null
  nature_of_business?: string | null
  outstanding_amount?: number | null
  cert_url?: string | null
  is_not_msme?: boolean
  declarant_name?: string | null
  submitted_at?: string | null
}

const CATEGORIES = [
  { value: 'micro',  label: 'Micro Enterprise',  hint: 'Investment in plant & machinery up to ₹1 crore, turnover up to ₹5 crore' },
  { value: 'small',  label: 'Small Enterprise',   hint: 'Investment up to ₹10 crore, turnover up to ₹50 crore' },
  { value: 'medium', label: 'Medium Enterprise',  hint: 'Investment up to ₹50 crore, turnover up to ₹250 crore' },
]

const NATURE = [
  { value: 'manufacturer',    label: 'Manufacturer',      hint: 'You make or produce goods' },
  { value: 'service_provider',label: 'Service Provider',  hint: 'You provide services (consulting, IT, etc.)' },
  { value: 'trader',          label: 'Trader',            hint: 'You buy and sell goods without manufacturing' },
]

const CAT_LABEL: Record<string, string> = { micro: 'Micro Enterprise', small: 'Small Enterprise', medium: 'Medium Enterprise' }
const NAT_LABEL: Record<string, string>  = { manufacturer: 'Manufacturer', service_provider: 'Service Provider', trader: 'Trader' }

// Steps shown in the progress indicator
const STEPS = ['Your details', 'Category & type', 'Certificate upload', 'Confirm & submit']

export function MsmeVendorForm({ token }: { token: string }) {
  const [loading,    setLoading]    = useState(true)
  const [info,       setInfo]       = useState<VendorInfo | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [submitted,  setSubmitted]  = useState(false)

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

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(/Mobi|Android/i.test(navigator.userAgent)) }, [])

  useEffect(() => {
    fetch(`/api/msme/submit/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setInfo(d)
        if (d.already_submitted) setSubmitted(true)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load the form. Please try again or ask your firm to resend the link.'); setLoading(false) })
  }, [token])

  // Udyam format validation — live
  const udyamClean = udyamNumber.trim().toUpperCase()
  const udyamValid = UDYAM_REGEX.test(udyamClean)
  const udyamTouched = udyamNumber.length > 0

  // Derive progress step (0-indexed)
  function currentStep(): number {
    if (isNotMsme) return declarantName.trim() ? 3 : 0
    if (!udyamClean || !udyamValid) return 0
    if (!msmeCategory || !natureOfBusiness) return 1
    if (!certUrl) return 2
    return 3
  }
  const step = currentStep()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFile(file)
    setUploading(true)
    setFormError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res  = await fetch(`/api/msme/upload/${token}`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { setFormError(data.error ?? 'Upload failed'); setCertFile(null); return }
    setCertUrl(data.cert_url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (isNotMsme) {
      if (!declarantName.trim()) { setFormError('Please enter your full name for the declaration.'); return }
    } else {
      if (!udyamClean || !udyamValid) { setFormError('Please enter a valid Udyam Registration Number.'); return }
      if (!msmeCategory) { setFormError('Please select your MSME category.'); return }
      if (!natureOfBusiness) { setFormError('Please select your nature of business.'); return }
      if (!certUrl) { setFormError('Please upload your Udyam Registration Certificate.'); return }
    }

    setSaving(true)
    const payload = isNotMsme
      ? { is_not_msme: true, declarant_name: declarantName }
      : {
          is_not_msme: false,
          udyam_number: udyamClean,
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
    // Refresh info to show receipt
    setInfo(prev => prev ? ({
      ...prev,
      already_submitted: true,
      udyam_number: isNotMsme ? null : udyamClean,
      msme_category: isNotMsme ? null : msmeCategory,
      nature_of_business: isNotMsme ? null : natureOfBusiness,
      outstanding_amount: isNotMsme || outstandingAmount === '' ? null : Number(outstandingAmount),
      cert_url: isNotMsme ? null : certUrl,
      is_not_msme: isNotMsme,
      declarant_name: isNotMsme ? declarantName : null,
      submitted_at: new Date().toISOString(),
    }) : prev)
    setSubmitted(true)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
          Loading your form…
        </div>
      </div>
    </div>
  )

  // ── Error (expired / invalid) ──────────────────────────────────────────
  if (error) return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 44, textAlign: 'center', marginBottom: 16 }}>🔗</div>
        <h1 style={{ ...h1, textAlign: 'center' }}>Link Expired or Invalid</h1>
        <p style={{ ...sub, textAlign: 'center', marginBottom: 0 }}>{error}</p>
        <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 28 }}>Powered by upFloat</p>
      </div>
    </div>
  )

  // ── Submission receipt (shown both right after submit AND on re-open) ──
  if (submitted && info) return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 500 }}>
        <div style={{ background: '#0f172a', margin: '-32px -32px 28px', padding: '18px 28px', borderRadius: '12px 12px 0 0' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>⚡ {info.org_name}</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h1 style={{ ...h1, textAlign: 'center', marginBottom: 4 }}>Details submitted</h1>
          <p style={{ ...sub, textAlign: 'center' }}>
            {info.org_name} has been notified. No further action needed from you.
          </p>
        </div>

        {/* Summary of what was submitted */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, marginBottom: 20 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>What you submitted</p>

          {info.is_not_msme ? (
            <div>
              <ReceiptRow label="Type"        value="Non-MSME Declaration" />
              {info.declarant_name && <ReceiptRow label="Declared by" value={info.declarant_name} />}
              {info.submitted_at   && <ReceiptRow label="Date"        value={new Date(info.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />}
            </div>
          ) : (
            <div>
              {info.udyam_number      && <ReceiptRow label="Udyam No."        value={info.udyam_number} />}
              {info.msme_category     && <ReceiptRow label="Category"          value={CAT_LABEL[info.msme_category] ?? info.msme_category} />}
              {info.nature_of_business&& <ReceiptRow label="Nature"            value={NAT_LABEL[info.nature_of_business] ?? info.nature_of_business} />}
              {info.outstanding_amount !== null && info.outstanding_amount !== undefined && (
                <ReceiptRow label="Outstanding (31 Mar)" value={`₹${Number(info.outstanding_amount).toLocaleString('en-IN')}`} />
              )}
              {info.submitted_at && <ReceiptRow label="Submitted on" value={new Date(info.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />}
              {info.cert_url && <ReceiptRow label="Certificate" value="Uploaded ✓" />}
            </div>
          )}
        </div>

        <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', lineHeight: 1.6, margin: '0 0 16px' }}>
          Please save this page as a record of your submission.<br/>
          If you need to make any corrections, contact {info.org_name} directly.
        </p>

        <p style={{ color: '#64748b', fontSize: 11, textAlign: 'center', margin: 0 }}>Powered by upFloat</p>
      </div>
    </div>
  )

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 560 }}>
        {/* Header */}
        <div style={{ background: '#0f172a', margin: '-32px -32px 28px', padding: '18px 28px', borderRadius: '12px 12px 0 0' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>⚡ {info?.org_name}</span>
        </div>

        <h1 style={{ ...h1, marginBottom: 4 }}>Share Your MSME Details</h1>
        <p style={{ ...sub, marginBottom: 20 }}>
          Hi {info?.vendor_name} — {info?.org_name} is building a verified vendor registry to help businesses
          stay compliant under Section 43B(h). Your details will be securely recorded on their behalf.
          Takes under 2 minutes.
        </p>

        {/* Progress indicator */}
        {!isNotMsme && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: i < step ? ACCENT : i === step ? `${ACCENT}22` : '#f1f5f9',
                  color: i < step ? '#fff' : i === step ? ACCENT : '#94a3b8',
                  border: i === step ? `2px solid ${ACCENT}` : '2px solid transparent',
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < step ? ACCENT : '#e2e8f0', margin: '0 4px' }} />
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Not-MSME toggle */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24, cursor: 'pointer', background: isNotMsme ? '#f0f9ff' : '#f8fafc', border: `1.5px solid ${isNotMsme ? '#bae6fd' : '#e2e8f0'}`, borderRadius: 8, padding: '12px 14px' }}>
            <input
              type="checkbox"
              checked={isNotMsme}
              onChange={e => setIsNotMsme(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: ACCENT, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.5 }}>
              <strong>We are NOT an MSME</strong> — we are not registered under the Micro, Small and
              Medium Enterprises Development Act. I want to submit a declaration instead.
            </span>
          </label>

          {isNotMsme ? (
            /* Non-MSME declaration */
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#0369a1', marginBottom: 14, lineHeight: 1.6 }}>
                By submitting, you confirm your business is not registered as an MSME and has no Udyam number.
                {info?.org_name} will keep this on file so your relationship is accurately classified for their compliance records.
              </p>
              <div>
                <label style={labelStyle}>Your full name (as authorised signatory) <span style={{ color: '#dc2626' }}>*</span></label>
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
            <div>
              {/* Udyam Number */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Udyam Registration Number <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      ...inputStyle,
                      borderColor: udyamTouched ? (udyamValid ? '#16a34a' : '#dc2626') : '#e2e8f0',
                      paddingRight: 36,
                    }}
                    type="text"
                    placeholder="UDYAM-MH-15-0012345"
                    value={udyamNumber}
                    onChange={e => setUdyamNumber(e.target.value.toUpperCase())}
                  />
                  {udyamTouched && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>
                      {udyamValid ? '✅' : '❌'}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 6, padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#334155', lineHeight: 1.6 }}>
                    <strong>Where to find it:</strong> Your Udyam Registration Certificate (downloaded from{' '}
                    <span style={{ color: ACCENT }}>udyamregistration.gov.in</span>) shows the number at the top.
                    It looks like: <strong>UDYAM-MH-15-0012345</strong>
                    <br/>Format: UDYAM · [2-letter state code] · [2-digit district] · [7 digits]
                  </p>
                </div>
                {udyamTouched && !udyamValid && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>
                    Format doesn't match. Check your certificate for the exact number.
                  </p>
                )}
              </div>

              {/* MSME Category */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>MSME Category <span style={{ color: '#dc2626' }}>*</span></label>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569' }}>Select the category shown on your Udyam certificate.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <label
                      key={c.value}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                        padding: '10px 14px', borderRadius: 8,
                        border: `2px solid ${msmeCategory === c.value ? ACCENT : '#e2e8f0'}`,
                        background: msmeCategory === c.value ? `${ACCENT}08` : '#ffffff',
                        colorScheme: 'light',
                      }}
                    >
                      <input
                        type="radio" name="msme_category" value={c.value}
                        checked={msmeCategory === c.value}
                        onChange={() => setMsmeCategory(c.value)}
                        style={{ marginTop: 2, accentColor: ACCENT }}
                      />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{c.label}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Nature of business */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Nature of Business <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {NATURE.map(n => (
                    <label
                      key={n.value}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                        padding: '10px 14px', borderRadius: 8,
                        border: `2px solid ${natureOfBusiness === n.value ? ACCENT : '#e2e8f0'}`,
                        background: natureOfBusiness === n.value ? `${ACCENT}08` : '#ffffff',
                        colorScheme: 'light',
                      }}
                    >
                      <input
                        type="radio" name="nature_of_business" value={n.value}
                        checked={natureOfBusiness === n.value}
                        onChange={() => setNatureOfBusiness(n.value)}
                        style={{ marginTop: 2, accentColor: ACCENT }}
                      />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{n.label}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Outstanding amount */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Last outstanding amount as on 31st March (₹)
                  <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b', fontWeight: 400, background: '#fff' }}>optional</span>
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 125000"
                  value={outstandingAmount}
                  onChange={e => setOutstandingAmount(e.target.value)}
                />
                <div style={{ marginTop: 6, padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#713f12', lineHeight: 1.6 }}>
                    <strong>What this means:</strong> The amount <em>your firm is owed</em> (money {info?.org_name} owes you)
                    that was unpaid as of 31st March of the last financial year. Enter <strong>0</strong> if fully paid up.
                    Leave blank if you don't have this figure.
                  </p>
                </div>
              </div>

              {/* Certificate upload */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Udyam Registration Certificate <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, textAlign: 'center',
                  border: `2px dashed ${certUrl ? ACCENT : '#e2e8f0'}`,
                  borderRadius: 10, padding: '20px 18px', cursor: 'pointer',
                  background: certUrl ? `${ACCENT}06` : '#fafafa',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{ display: 'none' }} />
                  {uploading ? (
                    <>
                      <div style={{ fontSize: 24 }}>⏳</div>
                      <span style={{ fontSize: 13, color: '#334155' }}>Uploading…</span>
                    </>
                  ) : certUrl ? (
                    <>
                      <div style={{ fontSize: 24 }}>✅</div>
                      <span style={{ fontSize: 13, color: ACCENT, fontWeight: 700 }}>
                        {certFile?.name ?? 'Certificate uploaded successfully'}
                      </span>
                      <span style={{ fontSize: 11, color: '#475569' }}>{isMobile ? 'Tap' : 'Click'} to replace</span>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 28 }}>📄</div>
                      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                        {isMobile ? 'Tap to upload' : 'Click to upload'} your Udyam certificate
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>PDF, JPG or PNG · max 5 MB</span>
                    </>
                  )}
                </label>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569' }}>
                  This is the certificate downloaded from udyamregistration.gov.in or Udyam Assist portal.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ color: '#dc2626', fontSize: 13, margin: 0, lineHeight: 1.5 }}>⚠ {formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || uploading}
            style={{
              width: '100%', padding: '14px 0',
              background: saving || uploading ? '#94a3b8' : ACCENT,
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: saving || uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Submitting…' : uploading ? 'Please wait — uploading…' : isNotMsme ? 'Submit Declaration' : 'Submit MSME Details'}
          </button>
        </form>

        <p style={{ color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          Your information is shared only with {info?.org_name} for MSME compliance purposes.<br/>
          Powered by upFloat
        </p>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, gap: 12 }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
// colorScheme: 'light' forces the browser to always render this public page in
// light mode, regardless of the user's system dark-mode preference.
const pageStyle: React.CSSProperties = {
  colorScheme: 'light',
  minHeight: '100vh', background: '#f8fafc', display: 'flex',
  alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  color: '#0f172a',
}
const cardStyle: React.CSSProperties = {
  colorScheme: 'light',
  background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
  padding: 32, width: '100%', maxWidth: 560, color: '#0f172a',
}
const h1: React.CSSProperties = { margin: '0 0 6px', color: '#0f172a', fontSize: 20, fontWeight: 700 }
const sub: React.CSSProperties = { color: '#475569', fontSize: 14, margin: 0, lineHeight: 1.6 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
  fontSize: 14, color: '#0f172a', background: '#ffffff', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}
