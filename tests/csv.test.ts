import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, toCsv } from '../lib/utils/csv.ts'

test('a plain value is left alone', () => {
  assert.equal(csvCell('GSTR 1 (Monthly)'), 'GSTR 1 (Monthly)')
})

test('a value containing a comma is quoted', () => {
  // Real task names in this calendar contain commas; without quoting, every
  // column after it shifts by one.
  assert.equal(csvCell('TDS, TCS and more'), '"TDS, TCS and more"')
})

test('embedded quotes are doubled, not dropped', () => {
  assert.equal(csvCell('He said "no"'), '"He said ""no"""')
})

test('newlines force quoting', () => {
  assert.equal(csvCell('line one\nline two'), '"line one\nline two"')
})

test('null and undefined become empty, not the string "null"', () => {
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(undefined), '')
  assert.equal(csvCell(''), '')
})

test('a leading = is neutralised so Excel does not run it as a formula', () => {
  // CSV injection: =HYPERLINK(...) or =cmd|... executes on open in Excel.
  assert.equal(csvCell('=1+1'), "'=1+1")
  assert.equal(csvCell('+44 20 1234'), "'+44 20 1234")
  assert.equal(csvCell('-5'), "'-5")
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)")
})

test('a minus inside a value is not touched, only a leading one', () => {
  assert.equal(csvCell('GST R1 - IFF'), 'GST R1 - IFF')
})

test('toCsv joins with CRLF, which is what Excel expects', () => {
  const out = toCsv([['a', 'b'], ['c', 'd']])
  assert.equal(out, 'a,b\r\nc,d')
})

test('a full row with a comma stays aligned', () => {
  const out = toCsv([['Group', 'Name', 'Apr'], ['GST', 'R1, Quarterly', '2026-04-13']])
  assert.equal(out, 'Group,Name,Apr\r\nGST,"R1, Quarterly",2026-04-13')
  // Splitting naively on commas would give 4 fields for row 2; quoted it is 3.
  assert.equal(out.split('\r\n')[1].match(/"/g)?.length, 2)
})
