/**
 * Escape one CSV cell, RFC 4180 style.
 *
 * A value is quoted when it contains a comma, a quote or a newline, and any
 * quote inside is doubled. Getting this wrong shifts every later column of a
 * row by one — and CA task names routinely contain commas, e.g.
 * "GST R1 - IFF/ R1 Quaterly (QRMP)".
 *
 * A leading =, +, - or @ is prefixed with an apostrophe. Excel treats such a
 * cell as a formula, which both corrupts the value and is the standard CSV
 * injection vector.
 */
export function csvCell(value: string | null | undefined): string {
  let v = value ?? ''
  if (/^[=+\-@]/.test(v)) v = "'" + v
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

/** Join rows into an Excel-readable CSV body (CRLF line endings). */
export function toCsv(rows: (string | null | undefined)[][]): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n')
}
