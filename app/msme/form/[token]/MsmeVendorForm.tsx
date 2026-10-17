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
  udyam_number?: string | null
  msme_category?: string | null
  nature_of_business?: string | null
  outstanding_amount?: number | null
  cert_url?: string | null
  is_not_msme?: boolean
  declarant_name?: string | null
  submitted_at?: string | null

  // ── which half-year this form is asking about ──
  // Form MSME-1 is filed twice a year: as on 31 March and as on 30 September.
  // The vendor must know which date their balance should reflect.
  period_end?: string
  period_label?: string
  period_due?: string

  /**
   * Details carried forward from this vendor's previous declaration.
   *
   * Registration details do not change between half-years, so a returning
   * vendor confirms them instead of re-keying a form they already filled in.
   * outstanding_amount is deliberately absent: carrying a six-month-old
   * balance would let it be confirmed without ever being looked at.
   */
  prefill?: {
    udyam_number?:        string | null
    pan?:                 string | null
    udyam_registered_on?: string | null
    msme_category?:       string | null
    nature_of_business?:  string | null
    cert_url?:            string | null
    is_not_msme?:         boolean
  }
  is_returning?: boolean
  /** Last cycle's figures, shown as read-only context. */
  previous?: {
    period_label:       string
    outstanding_amount: number | null
    is_not_msme:        boolean
  } | null
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

// Pages for the multi-step MSME form
// Page 1: MSME status (yes / no)
// Page 2: Category + Nature of business
// Page 3: Udyam number + Certificate + Outstanding amount
const STEPS = ['MSME Status', 'Category & Type', 'Registration Details']

export function MsmeVendorForm({ token }: { token: string }) {
  const [loading,    setLoading]    = useState(true)
  const [info,       setInfo]       = useState<VendorInfo | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [submitted,  setSubmitted]  = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  // Page navigation
  const [page, setPage] = useState<1 | 2 | 3>(1)

  // Page 1: MSME status
  const [isMsme,            setIsMsme]            = useState<boolean | null>(null)  // null = not chosen yet
  const [declarantName,     setDeclarantName]     = useState('')

  // Page 2: Category + Nature
  const [msmeCategory,      setMsmeCategory]      = useState('')
  const [natureOfBusiness,  setNatureOfBusiness]  = useState('')

  // Page 3: Udyam + Certificate + Outstanding
  const [udyamNumber,       setUdyamNumber]       = useState('')
  const [outstandingAmount, setOutstandingAmount] = useState('')
  const [certFile,          setCertFile]          = useState<File | null>(null)
  const [certUrl,           setCertUrl]           = useState<string | null>(null)
  // True while certUrl is the certificate carried over from a previous
  // half-year rather than one uploaded in this session. Without this the
  // dropzone would claim "uploaded successfully" for a file the vendor has
  // not touched, which reads as a bug the first time they see it.
  const [certCarried,       setCertCarried]       = useState(false)
  const [proofFile,         setProofFile]         = useState<File | null>(null)
  const [proofUrl,          setProofUrl]          = useState<string | null>(null)
  const [uploading,         setUploading]         = useState(false)
  const [uploadingProof,    setUploadingProof]    = useState(false)
  const [saving,            setSaving]            = useState(false)
  const [formError,         setFormError]         = useState<string | null>(null)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(/Mobi|Android/i.test(navigator.userAgent)) }, [])

  // Pre-select the MSME / not-MSME path from the email's one-click buttons
  // (?a=msme or ?a=not_msme). The vendor still confirms + consents on the form —
  // this just skips the first question. Reduces friction without bypassing DPDP.
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('a')
    if (a === 'msme')      setIsMsme(true)
    else if (a === 'not_msme') setIsMsme(false)
  }, [])

  useEffect(() => {
    fetch(`/api/msme/submit/${token}`)
      .then(async r => {
        const d = await r.json().catch(() => ({ error: 'Failed to load the form. Please try again or ask the sender to resend the link.' }))
        if (!r.ok || d.error) { setError(d.error ?? 'Failed to load the form.'); setLoading(false); return }
        setInfo(d)
        if (d.already_submitted) setSubmitted(true)

        // Pre-fill what the vendor told us last half-year, so this cycle is a
        // confirmation rather than a re-fill. The outstanding amount and its
        // supporting document are NOT pre-filled — restating the balance is
        // the entire point of the new return.
        const pf = d.prefill
        if (pf && !d.already_submitted) {
          if (pf.udyam_number)       setUdyamNumber(pf.udyam_number)
          if (pf.msme_category)      setMsmeCategory(pf.msme_category)
          if (pf.nature_of_business) setNatureOfBusiness(pf.nature_of_business)
          // The Udyam certificate is a registration document, not a
          // period-specific one, so last cycle's upload still stands and the
          // vendor is not asked for the same PDF twice.
          if (pf.cert_url)         { setCertUrl(pf.cert_url); setCertCarried(true) }
          // Only infer the MSME path for a vendor who actually declared
          // before. is_not_msme defaults to false, and treating that default
          // as an answer would silently pre-answer the first question.
          //
          // An explicit ?a= choice from the email's one-click buttons always
          // wins: a vendor who just pressed "No — we're not an MSME" must not
          // be flipped back by what they answered six months ago.
          const clicked = new URLSearchParams(window.location.search).get('a')
          if (!clicked && d.is_returning) {
            if (pf.is_not_msme === true)  setIsMsme(false)
            if (pf.is_not_msme === false) setIsMsme(true)
          }
        }
        setLoading(false)
      })
      .catch(() => { setError('Failed to load the form. Please try again or ask the sender to resend the link.'); setLoading(false) })
  }, [token])

  // The date this form's figures must reflect, in words. Every "as on" in the
  // form reads from here, so the September and March cycles can never show
  // each other's date.
  const asOnLabel = info?.period_end
    ? new Date(`${info.period_end}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'the reporting date'

  const udyamClean   = udyamNumber.trim().toUpperCase()
  const udyamValid   = UDYAM_REGEX.test(udyamClean)
  const udyamTouched = udyamNumber.length > 0

  const outstandingNum = outstandingAmount !== '' ? Number(outstandingAmount) : null
  const needsProof     = outstandingNum !== null && !isNaN(outstandingNum) && outstandingNum > 0

  async function handleCertFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFile(file)
    setUploading(true)
    setFormError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', 'cert')
    const res  = await fetch(`/api/msme/upload/${token}`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { setFormError(data.error ?? 'Upload failed'); setCertFile(null); return }
    setCertUrl(data.url ?? data.cert_url)
    setCertCarried(false)   // this one was uploaded here and now
  }

  async function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    setUploadingProof(true)
    setFormError(null)
    const fd = new FormData()
    fd.append('file', file)
    // Says this is the payment proof, not the Udyam certificate. Without it
    // the upload was pre-saved to cert_url and overwrote the certificate.
    fd.append('kind', 'proof')
    const res  = await fetch(`/api/msme/upload/${token}`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploadingProof(false)
    if (!res.ok) { setFormError(data.error ?? 'Upload failed'); setProofFile(null); return }
    setProofUrl(data.url ?? data.cert_url)
  }

  async function handleSubmit() {
    setFormError(null)

    if (!consentGiven) {
      setFormError('Please tick the consent checkbox to proceed — it is required under the Digital Personal Data Protection Act, 2023.')
      return
    }

    if (isMsme === false) {
      // Non-MSME declaration
      if (!declarantName.trim()) { setFormError('Please enter your full name for the declaration.'); return }
    } else {
      if (!udyamClean || !udyamValid) { setFormError('Please enter a valid Udyam Registration Number.'); return }
      if (!msmeCategory) { setFormError('Please select your MSME category.'); return }
      if (!natureOfBusiness) { setFormError('Please select your nature of business.'); return }
      if (!certUrl) { setFormError('Please upload your Udyam Registration Certificate.'); return }
      if (needsProof && !proofUrl) { setFormError('Please upload a supporting document for the outstanding amount.'); return }
    }

    setSaving(true)
    const payload = isMsme === false
      ? { is_not_msme: true, declarant_name: declarantName, consent: true }
      : {
          consent: true,
          is_not_msme: false,
          udyam_number: udyamClean,
          msme_category: msmeCategory,
          nature_of_business: natureOfBusiness,
          outstanding_amount: outstandingAmount === '' ? null : outstandingAmount,
          cert_url: certUrl,
          proof_url: proofUrl,
        }

    const res  = await fetch(`/api/msme/submit/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setFormError(data.error ?? 'Submission failed. Please try again.'); return }
    setInfo(prev => prev ? ({
      ...prev,
      already_submitted: true,
      udyam_number: isMsme === false ? null : udyamClean,
      msme_category: isMsme === false ? null : msmeCategory,
      nature_of_business: isMsme === false ? null : natureOfBusiness,
      outstanding_amount: isMsme === false || outstandingAmount === '' ? null : Number(outstandingAmount),
      cert_url: isMsme === false ? null : certUrl,
      is_not_msme: isMsme === false,
      declarant_name: isMsme === false ? declarantName : null,
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

  // ── Submission receipt ──────────────────────────────────────────────────
  if (submitted && info) return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 500 }}>
        <div style={{ background: '#0f172a', margin: '-32px -32px 28px', padding: '18px 28px', borderRadius: '12px 12px 0 0' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>MSME Compliance — {info.org_name}</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h1 style={{ ...h1, textAlign: 'center', marginBottom: 4 }}>Details submitted</h1>
          <p style={{ ...sub, textAlign: 'center' }}>
            {info.org_name} has been notified. No further action needed from you.
          </p>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, marginBottom: 20 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            What you submitted
            {/* Names the half-year, so a vendor who files twice a year can tell
                which receipt they are looking at. */}
            {info.period_label && (
              <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 2 }}>
                {info.period_label}
              </span>
            )}
          </p>

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
                <ReceiptRow label={`Outstanding (as on ${asOnLabel})`} value={`₹${Number(info.outstanding_amount).toLocaleString('en-IN')}`} />
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
  const completedSteps = page - 1   // steps before the current one are complete

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 560 }}>
        {/* Header */}
        <div style={{ background: '#0f172a', margin: '-32px -32px 28px', padding: '18px 28px', borderRadius: '12px 12px 0 0' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>MSME Compliance — {info?.org_name}</span>
        </div>

        <h1 style={{ ...h1, marginBottom: 4 }}>
          {info?.is_returning ? 'Confirm Your MSME Details' : 'Share Your MSME Details'}
        </h1>
        <p style={{ ...sub, marginBottom: info?.period_label ? 14 : 20 }}>
          {info?.is_returning
            ? <>Dear {info?.vendor_name} — thank you for confirming earlier. {info?.org_name} files Form MSME-1 twice a year, so this is the next half-yearly confirmation.</>
            : <>Dear {info?.vendor_name} — {info?.org_name} is collecting MSME registration details from vendors for statutory compliance. This takes under 2 minutes.</>}
        </p>

        {/* Which half-year this form covers. Form MSME-1 is filed twice a
            year, so without this a vendor cannot tell which date their
            balance should reflect — or that this is not the same form again. */}
        {info?.period_label && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '10px 14px', marginBottom: info?.is_returning ? 12 : 20,
          }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Reporting period
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.5 }}>
              {info.period_label}
            </p>
          </div>
        )}

        {/* The returning vendor's shortcut: most of the form is already
            filled, and only the balance genuinely needs restating. */}
        {info?.is_returning && !submitted && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
            padding: '12px 14px', marginBottom: 20,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: '#1e40af', lineHeight: 1.65 }}>
              ✓ <strong>Your details are already filled in</strong> from your last confirmation.
              Please check they are still correct, then update your <strong>outstanding balance as on {asOnLabel}</strong>.
            </p>
          </div>
        )}

        {/* Step indicator — only shown when user has chosen MSME status = Yes */}
        {isMsme === true && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: i < completedSteps ? ACCENT : i === completedSteps ? `${ACCENT}22` : '#f1f5f9',
                  color: i < completedSteps ? '#fff' : i === completedSteps ? ACCENT : '#94a3b8',
                  border: i === completedSteps ? `2px solid ${ACCENT}` : '2px solid transparent',
                }}>
                  {i < completedSteps ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < completedSteps ? ACCENT : '#e2e8f0', margin: '0 4px' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Page 1: MSME Status ── */}
        {page === 1 && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>
              Is your business registered as an MSME under the Udyam Registration?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                padding: '14px 16px', borderRadius: 8,
                border: `2px solid ${isMsme === true ? ACCENT : '#e2e8f0'}`,
                background: isMsme === true ? `${ACCENT}08` : '#ffffff',
              }}>
                <input
                  type="radio" name="is_msme" value="yes"
                  checked={isMsme === true}
                  onChange={() => setIsMsme(true)}
                  style={{ marginTop: 2, accentColor: ACCENT }}
                />
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Yes — we are a registered MSME</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>We have a valid Udyam Registration Certificate</p>
                </div>
              </label>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                padding: '14px 16px', borderRadius: 8,
                border: `2px solid ${isMsme === false ? '#0284c7' : '#e2e8f0'}`,
                background: isMsme === false ? '#f0f9ff' : '#ffffff',
              }}>
                <input
                  type="radio" name="is_msme" value="no"
                  checked={isMsme === false}
                  onChange={() => setIsMsme(false)}
                  style={{ marginTop: 2, accentColor: '#0284c7' }}
                />
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>No — we are not registered as an MSME</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>We do not have a Udyam Registration Certificate</p>
                </div>
              </label>
            </div>

            {/* Non-MSME declaration form */}
            {isMsme === false && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#0369a1', marginBottom: 14, lineHeight: 1.6 }}>
                  By submitting, you confirm your business is not registered as an MSME and has no Udyam number.
                  {info?.org_name} will keep this declaration on file for their compliance records.
                </p>
                <div>
                  <label style={labelStyle}>Your full name (as authorised signatory) <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="e.g. Rajesh Kumar Sharma"
                    value={declarantName}
                    onChange={e => setDeclarantName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {isMsme === false && <ConsentCheckbox checked={consentGiven} onChange={setConsentGiven} />}

            {formError && <ErrorBox>{formError}</ErrorBox>}

            <div style={{ display: 'flex', gap: 10 }}>
              {isMsme === true && (
                <button
                  type="button"
                  onClick={() => { setFormError(null); setPage(2) }}
                  style={{ ...primaryBtn, flex: 1 }}
                >
                  Continue →
                </button>
              )}
              {isMsme === false && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmit}
                  style={{ ...primaryBtn, flex: 1 }}
                >
                  {saving ? 'Submitting…' : 'Submit Declaration'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Page 2: Category + Nature ── */}
        {page === 2 && (
          <div>
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

            {formError && <ErrorBox>{formError}</ErrorBox>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setFormError(null); setPage(1) }} style={{ ...ghostBtn, flex: 1 }}>← Back</button>
              <button
                type="button"
                onClick={() => {
                  setFormError(null)
                  if (!msmeCategory) { setFormError('Please select your MSME category.'); return }
                  if (!natureOfBusiness) { setFormError('Please select your nature of business.'); return }
                  setPage(3)
                }}
                style={{ ...primaryBtn, flex: 1 }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Page 3: Udyam + Certificate + Outstanding ── */}
        {page === 3 && (
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
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                Format: UDYAM-[State]-[District]-[7 digits] &nbsp;·&nbsp; e.g. UDYAM-MH-15-0012345
              </p>
              {udyamTouched && !udyamValid && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>
                  Format does not match. Please check your Udyam certificate for the exact number.
                </p>
              )}
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
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleCertFileChange} style={{ display: 'none' }} />
                {uploading ? (
                  <>
                    <div style={{ fontSize: 24 }}>⏳</div>
                    <span style={{ fontSize: 13, color: '#334155' }}>Uploading…</span>
                  </>
                ) : certUrl ? (
                  <>
                    <div style={{ fontSize: 24 }}>✅</div>
                    <span style={{ fontSize: 13, color: ACCENT, fontWeight: 700 }}>
                      {certFile?.name
                        ?? (certCarried
                          ? 'Certificate already on file from your last confirmation'
                          : 'Certificate uploaded successfully')}
                    </span>
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      {certCarried
                        ? `${isMobile ? 'Tap' : 'Click'} to upload a newer certificate`
                        : `${isMobile ? 'Tap' : 'Click'} to replace`}
                    </span>
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

            {/* Outstanding amount — the ONE field a returning vendor must
                restate. Its label names the period's own as-on date; it used
                to say "31st March" regardless, which was wrong for the
                September cycle every single year. */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>
                Outstanding amount as on {asOnLabel} (₹)
                <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b', fontWeight: 400 }}>leave blank if nil</span>
              </label>
              {/* Last cycle's figure, for reference only. Shown rather than
                  pre-filled: a stale balance that can be confirmed without
                  being looked at is worse than no balance at all. */}
              {info?.previous && info.previous.outstanding_amount !== null && (
                <p style={{
                  margin: '0 0 6px', fontSize: 11, color: '#1e40af', background: '#eff6ff',
                  border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5,
                }}>
                  For reference, you declared <strong>₹{Number(info.previous.outstanding_amount).toLocaleString('en-IN')}</strong> for {info.previous.period_label}.
                  Please enter the amount outstanding as on {asOnLabel}.
                </p>
              )}
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                placeholder={`Enter amount owed to you as on ${asOnLabel} — enter 0 if fully paid`}
                value={outstandingAmount}
                onChange={e => setOutstandingAmount(e.target.value)}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                The amount {info?.org_name} owes you that was unpaid as on {asOnLabel}.
              </p>
            </div>

            {/* Proof upload — required when outstanding amount > 0 */}
            {needsProof && (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Supporting proof for outstanding amount <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  Since you have declared a pending outstanding amount, please upload a supporting document
                  (e.g. invoice, ledger statement, or account statement showing the outstanding balance).
                </p>
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, textAlign: 'center',
                  border: `2px dashed ${proofUrl ? ACCENT : '#f59e0b'}`,
                  borderRadius: 10, padding: '18px 16px', cursor: 'pointer',
                  background: proofUrl ? `${ACCENT}06` : '#fffbeb',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleProofFileChange} style={{ display: 'none' }} />
                  {uploadingProof ? (
                    <>
                      <div style={{ fontSize: 24 }}>⏳</div>
                      <span style={{ fontSize: 13, color: '#334155' }}>Uploading…</span>
                    </>
                  ) : proofUrl ? (
                    <>
                      <div style={{ fontSize: 24 }}>✅</div>
                      <span style={{ fontSize: 13, color: ACCENT, fontWeight: 700 }}>
                        {proofFile?.name ?? 'Proof document uploaded'}
                      </span>
                      <span style={{ fontSize: 11, color: '#475569' }}>{isMobile ? 'Tap' : 'Click'} to replace</span>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 26 }}>📎</div>
                      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                        {isMobile ? 'Tap to upload' : 'Click to upload'} proof document
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>PDF, JPG or PNG · max 5 MB</span>
                    </>
                  )}
                </label>
              </div>
            )}

            <ConsentCheckbox checked={consentGiven} onChange={setConsentGiven} />

            {formError && <ErrorBox>{formError}</ErrorBox>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setFormError(null); setPage(2) }} style={{ ...ghostBtn, flex: 1 }}>← Back</button>
              <button
                type="button"
                disabled={saving || uploading || uploadingProof}
                onClick={handleSubmit}
                style={{
                  ...primaryBtn, flex: 1,
                  background: saving || uploading || uploadingProof ? '#94a3b8' : ACCENT,
                  cursor: saving || uploading || uploadingProof ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Submitting…' : uploading || uploadingProof ? 'Please wait — uploading…' : 'Submit MSME Details'}
              </button>
            </div>
          </div>
        )}

        <p style={{ color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          Your information is shared only with {info?.org_name} for MSME compliance purposes.{' '}
          <a href="/msme/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488', textDecoration: 'underline' }}>Privacy Notice</a><br/>
          Powered by upFloat
        </p>
      </div>
    </div>
  )
}

// DPDP Act, 2023: consent must be a clear affirmative action, informed by a
// notice describing the data, purpose, and the data principal's rights.
function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '12px 14px', marginBottom: 16,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, accentColor: '#0d9488', flexShrink: 0 }}
      />
      <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
        I consent to the collection and processing of the information submitted in this form
        (including my name and business details) for the purpose of MSME status verification
        under the MSMED Act, 2006 and Section 43B(h) compliance, as described in the{' '}
        <a href="/msme/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488', textDecoration: 'underline' }}>
          Privacy Notice
        </a>. I understand I can withdraw consent or request correction/erasure of my data at any time.
      </span>
    </label>
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

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
      <p style={{ color: '#dc2626', fontSize: 13, margin: 0, lineHeight: 1.5 }}>⚠ {children as string}</p>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
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
const primaryBtn: React.CSSProperties = {
  background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
  padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
