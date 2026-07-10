'use client'
// HIDDEN payment-pipeline test page — not linked from any nav.
// Visit /msme/test-pay directly. Only works for SUPER_ADMIN_EMAIL (the API
// returns 404 for everyone else). Charges a REAL ₹50/₹100 through the live
// Razorpay flow, verifies the signature, and activates NOTHING — refund the
// payment from the Razorpay dashboard afterwards.
import { useState } from 'react'

type Result = { ok: boolean; text: string } | null

export default function MsmeTestPayPage() {
  const [busy,   setBusy]   = useState(false)
  const [result, setResult] = useState<Result>(null)

  async function pay(amountPaise: number) {
    setBusy(true); setResult(null)
    try {
      const res = await fetch('/api/msme/pay/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_paise: amountPaise }),
      })
      const data = await res.json()
      if (!res.ok) { setResult({ ok: false, text: data.error ?? 'Not available' }); return }

      await new Promise<void>((resolve, reject) => {
        if ((window as any).Razorpay) { resolve(); return }
        const s = document.createElement('script')
        s.src = 'https://checkout.razorpay.com/v1/checkout.js'
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('Failed to load Razorpay'))
        document.body.appendChild(s)
      })

      const rzp = new (window as any).Razorpay({
        key:      data.key_id,
        order_id: data.order_id,
        amount:   data.amount,
        currency: 'INR',
        name:     'upFloat — payment test',
        description: `Pipeline verification (₹${amountPaise / 100})`,
        theme:    { color: '#0d9488' },
        handler: async (response: any) => {
          const v = await fetch('/api/msme/pay/test', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          })
          const vd = await v.json()
          setResult({ ok: v.ok && vd.verified, text: `${vd.verified ? '✅' : '❌'} ${vd.note ?? ''} (payment: ${vd.payment_id ?? '—'})` })
          setBusy(false)
        },
        modal: { ondismiss: () => { setBusy(false); setResult({ ok: false, text: 'Checkout closed without paying.' }) } },
      })
      rzp.open()
    } catch (e) {
      setResult({ ok: false, text: (e as Error)?.message ?? 'Something went wrong' })
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', padding: '0 20px', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>🔧 Razorpay pipeline test</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0 24px', lineHeight: 1.6 }}>
        Runs a <strong>real</strong> charge through the live payment flow to verify order creation,
        checkout, and signature verification. Activates nothing. Refund the payment from the
        Razorpay dashboard afterwards. Super-admin only — everyone else gets 404.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button disabled={busy} onClick={() => pay(5000)}
          style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', cursor: busy ? 'wait' : 'pointer',
            background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          Pay ₹50
        </button>
        <button disabled={busy} onClick={() => pay(10000)}
          style={{ flex: 1, padding: '12px 0', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
            border: '1.5px solid #0d9488', background: 'transparent', color: '#0d9488', fontWeight: 700, fontSize: 14 }}>
          Pay ₹100
        </button>
      </div>
      {result && (
        <p style={{ marginTop: 20, fontSize: 13, lineHeight: 1.6, padding: '12px 14px', borderRadius: 8,
          background: result.ok ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.08)',
          color: result.ok ? '#15803d' : '#b91c1c',
          border: `1px solid ${result.ok ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.25)'}` }}>
          {result.text}
        </p>
      )}
    </div>
  )
}
