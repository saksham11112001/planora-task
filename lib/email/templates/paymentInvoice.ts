interface GstDetails {
  gstin?:       string | null
  legal_name?:  string | null
  address_line1?: string | null
  city?:        string | null
  state_name?:  string | null
  pincode?:     string | null
}

export interface InvoiceProps {
  invoiceNumber:   string     // e.g. INV-20250620-A1B2C3
  invoiceDate:     string     // YYYY-MM-DD
  customerEmail:   string
  orgName:         string
  gstDetails?:     GstDetails | null
  itemDescription: string     // e.g. "upFloat Pro Plan — Monthly"
  amountPaise:     number     // GST-inclusive total charged on Razorpay
  paymentId:       string     // razorpay payment id for reference
}

const ACCENT    = '#0d9488'
const SELLER_NAME    = process.env.SELLER_LEGAL_NAME ?? 'Upfloat Technologies'
const SELLER_GSTIN   = process.env.SELLER_GSTIN      ?? ''
const SELLER_ADDRESS = process.env.SELLER_ADDRESS    ?? 'India'

export function paymentInvoiceSubject(p: Pick<InvoiceProps, 'invoiceNumber'>): string {
  return `Tax Invoice ${p.invoiceNumber} — upFloat`
}

export function paymentInvoiceHtml(p: InvoiceProps): string {
  // Amount breakdown: Razorpay charges GST-inclusive; reverse-calculate base + GST
  const totalRs  = p.amountPaise / 100
  const baseRs   = Math.round((p.amountPaise / 1.18)) / 100
  const igstRs   = Math.round(totalRs * 100 - baseRs * 100) / 100

  const fmt = (n: number) =>
    `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const buyerName    = p.gstDetails?.legal_name || p.orgName
  const buyerGstin   = p.gstDetails?.gstin?.trim().toUpperCase() || ''
  const buyerAddr1   = p.gstDetails?.address_line1 || ''
  const buyerCity    = p.gstDetails?.city || ''
  const buyerState   = p.gstDetails?.state_name || ''
  const buyerPin     = p.gstDetails?.pincode || ''
  const buyerAddrStr = [buyerAddr1, buyerCity && buyerState ? `${buyerCity}, ${buyerState}` : buyerCity || buyerState, buyerPin]
    .filter(Boolean).join('<br/>')

  const sellerGstRow = SELLER_GSTIN
    ? `<p style="margin:2px 0;font-size:12px;color:#475569">GSTIN: <strong>${SELLER_GSTIN}</strong></p>`
    : ''
  const buyerGstRow = buyerGstin
    ? `<p style="margin:2px 0;font-size:12px;color:#475569">GSTIN: <strong>${buyerGstin}</strong></p>`
    : ''

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">

  <!-- Header -->
  <tr><td style="background:#0f172a;padding:24px 32px;display:flex;align-items:center;justify-content:space-between">
    <table width="100%"><tr>
      <td><span style="color:#fff;font-size:18px;font-weight:700">upFloat</span></td>
      <td align="right">
        <span style="color:#94a3b8;font-size:13px">TAX INVOICE</span><br/>
        <span style="color:#fff;font-size:15px;font-weight:700">${p.invoiceNumber}</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- Invoice meta -->
  <tr><td style="padding:24px 32px 0">
    <table width="100%"><tr>
      <td width="50%" valign="top" style="padding-right:16px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.06em">INVOICE DATE</p>
        <p style="margin:0;font-size:13px;font-weight:600">${new Date(p.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </td>
      <td width="50%" valign="top" align="right">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.06em">PAYMENT REFERENCE</p>
        <p style="margin:0;font-size:12px;color:#475569;word-break:break-all">${p.paymentId}</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- Seller / Buyer -->
  <tr><td style="padding:20px 32px 0">
    <table width="100%" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <tr>
        <td width="50%" valign="top" style="padding:16px;border-right:1px solid #e2e8f0;background:#f8fafc">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.06em">BILLED FROM</p>
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0f172a">${SELLER_NAME}</p>
          ${sellerGstRow}
          <p style="margin:2px 0;font-size:12px;color:#475569">${SELLER_ADDRESS}</p>
        </td>
        <td width="50%" valign="top" style="padding:16px;background:#f8fafc">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.06em">BILLED TO</p>
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0f172a">${buyerName}</p>
          ${buyerGstRow}
          ${buyerAddrStr ? `<p style="margin:2px 0;font-size:12px;color:#475569;line-height:1.5">${buyerAddrStr}</p>` : ''}
          <p style="margin:2px 0;font-size:12px;color:#475569">${p.customerEmail}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Line items -->
  <tr><td style="padding:20px 32px 0">
    <table width="100%" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;border-collapse:collapse">
      <thead>
        <tr style="background:${ACCENT}10">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:${ACCENT};letter-spacing:0.05em">DESCRIPTION</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:${ACCENT};letter-spacing:0.05em;white-space:nowrap">SAC</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:${ACCENT};letter-spacing:0.05em">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-top:1px solid #e2e8f0">
          <td style="padding:14px;font-size:13px;color:#0f172a">${p.itemDescription}</td>
          <td style="padding:14px;font-size:12px;color:#64748b;text-align:right">998314</td>
          <td style="padding:14px;font-size:13px;font-weight:600;text-align:right">${fmt(baseRs)}</td>
        </tr>
      </tbody>
    </table>
  </td></tr>

  <!-- Totals -->
  <tr><td style="padding:0 32px 0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="right" style="padding:16px 0 0">
          <table style="min-width:240px">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#64748b">Subtotal (excl. GST)</td>
              <td style="padding:6px 0 6px 24px;font-size:13px;text-align:right">${fmt(baseRs)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#64748b">IGST @ 18%</td>
              <td style="padding:6px 0 6px 24px;font-size:13px;text-align:right">${fmt(igstRs)}</td>
            </tr>
            <tr style="border-top:2px solid #0f172a">
              <td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#0f172a">Total</td>
              <td style="padding:10px 0 0 24px;font-size:15px;font-weight:700;text-align:right;color:${ACCENT}">${fmt(totalRs)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Payment status -->
  <tr><td style="padding:20px 32px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;display:inline-block">
      <p style="margin:0;font-size:13px;color:#16a34a;font-weight:700">✓ Payment received — this is your tax invoice</p>
      <p style="margin:4px 0 0;font-size:12px;color:#475569">Powered by Razorpay · Payment ID: ${p.paymentId}</p>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
      This is a computer-generated tax invoice and does not require a signature.<br/>
      SAC 998314 — Information technology consulting and support services.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}
