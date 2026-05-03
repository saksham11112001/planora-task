import { CA_DEFAULT_TASKS } from './caDefaultTasks'
import type { CADefaultTask } from './caDefaultTasks'

export { CADefaultTask }

export interface CountryTaskSet {
  code: string       // e.g. 'IN', 'US', 'UK', 'CA', 'AU', 'EU'
  name: string       // e.g. 'India (CA/CMA)'
  flag: string       // emoji flag
  description: string
  tasks: CADefaultTask[]
}

/* ─── Helper: build tasks with country prefix on code ────────────── */
function prefixed(countryCode: string, tasks: CADefaultTask[]): CADefaultTask[] {
  return tasks.map(t => ({ ...t, code: `${countryCode}-${t.code}` }))
}

/* ══════════════════════════════════════════════════════════════════
   INDIA  (existing CA_DEFAULT_TASKS, unchanged)
══════════════════════════════════════════════════════════════════ */
const INDIA_TASKS = CA_DEFAULT_TASKS  // no prefix change for backward compat

/* ══════════════════════════════════════════════════════════════════
   UNITED STATES  (CPA / EA practice)
══════════════════════════════════════════════════════════════════ */
const US_TASKS_RAW: CADefaultTask[] = [
  // Individual & Pass-Through Returns
  { code: 'F1040',   name: 'Form 1040 – Individual Income Tax Return',          group_name: 'Individual Tax',  task_type: 'Annual Return',  sort_order: 10, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 3, attachment_headers: ['Signed Return', 'E-file Acknowledgement', 'Client Copy'] },
  { code: 'F1040EX', name: 'Form 4868 – Extension of Time (Individual)',          group_name: 'Individual Tax',  task_type: 'Extension',      sort_order: 11, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 1, attachment_headers: ['Extension Confirmation'] },
  { code: 'F1065',   name: 'Form 1065 – Partnership Return',                     group_name: 'Partnership Tax', task_type: 'Annual Return',  sort_order: 20, dates: { feb: '2026-03-15' },                                                                                    attachment_count: 3, attachment_headers: ['Signed Return', 'E-file Acknowledgement', 'K-1 Copies'] },
  { code: 'F1120S',  name: 'Form 1120-S – S Corporation Return',                 group_name: 'Corporate Tax',   task_type: 'Annual Return',  sort_order: 30, dates: { feb: '2026-03-15' },                                                                                    attachment_count: 3, attachment_headers: ['Signed Return', 'E-file Acknowledgement', 'K-1 Copies'] },
  { code: 'F1120',   name: 'Form 1120 – C Corporation Return',                   group_name: 'Corporate Tax',   task_type: 'Annual Return',  sort_order: 31, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 2, attachment_headers: ['Signed Return', 'E-file Acknowledgement'] },
  { code: 'F1120EX', name: 'Form 7004 – Extension (Corporations & Partnerships)', group_name: 'Corporate Tax',   task_type: 'Extension',      sort_order: 32, dates: { feb: '2026-03-15' },                                                                                    attachment_count: 1, attachment_headers: ['Extension Confirmation'] },
  { code: 'F1041',   name: 'Form 1041 – Fiduciary Income Tax (Estates/Trusts)',   group_name: 'Trust & Estate',  task_type: 'Annual Return',  sort_order: 40, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 2, attachment_headers: ['Signed Return', 'E-file Acknowledgement'] },
  // Estimated Taxes
  { code: 'EST-Q1',  name: 'Form 1040-ES – Estimated Tax Q1 (Apr 15)',            group_name: 'Estimated Tax',   task_type: 'Q1 Estimated',   sort_order: 50, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 1, attachment_headers: ['Voucher / EFTPS Confirmation'] },
  { code: 'EST-Q2',  name: 'Form 1040-ES – Estimated Tax Q2 (Jun 15)',            group_name: 'Estimated Tax',   task_type: 'Q2 Estimated',   sort_order: 51, dates: { may: '2026-06-15' },                                                                                    attachment_count: 1, attachment_headers: ['Voucher / EFTPS Confirmation'] },
  { code: 'EST-Q3',  name: 'Form 1040-ES – Estimated Tax Q3 (Sep 15)',            group_name: 'Estimated Tax',   task_type: 'Q3 Estimated',   sort_order: 52, dates: { aug: '2026-09-15' },                                                                                    attachment_count: 1, attachment_headers: ['Voucher / EFTPS Confirmation'] },
  { code: 'EST-Q4',  name: 'Form 1040-ES – Estimated Tax Q4 (Jan 15)',            group_name: 'Estimated Tax',   task_type: 'Q4 Estimated',   sort_order: 53, dates: { dec: '2027-01-15' },                                                                                    attachment_count: 1, attachment_headers: ['Voucher / EFTPS Confirmation'] },
  // Payroll
  { code: 'F941-Q1', name: 'Form 941 – Employer\'s Quarterly Return (Q1)',        group_name: 'Payroll & Employment', task_type: 'Q1 Payroll', sort_order: 60, dates: { may: '2026-04-30' },                                                                                   attachment_count: 2, attachment_headers: ['Signed Return', 'EFTPS Payment Proof'] },
  { code: 'F941-Q2', name: 'Form 941 – Employer\'s Quarterly Return (Q2)',        group_name: 'Payroll & Employment', task_type: 'Q2 Payroll', sort_order: 61, dates: { jun: '2026-07-31' },                                                                                   attachment_count: 2, attachment_headers: ['Signed Return', 'EFTPS Payment Proof'] },
  { code: 'F941-Q3', name: 'Form 941 – Employer\'s Quarterly Return (Q3)',        group_name: 'Payroll & Employment', task_type: 'Q3 Payroll', sort_order: 62, dates: { sep: '2026-10-31' },                                                                                   attachment_count: 2, attachment_headers: ['Signed Return', 'EFTPS Payment Proof'] },
  { code: 'F941-Q4', name: 'Form 941 – Employer\'s Quarterly Return (Q4)',        group_name: 'Payroll & Employment', task_type: 'Q4 Payroll', sort_order: 63, dates: { dec: '2027-01-31' },                                                                                   attachment_count: 2, attachment_headers: ['Signed Return', 'EFTPS Payment Proof'] },
  { code: 'F940',    name: 'Form 940 – FUTA (Annual Unemployment Tax)',            group_name: 'Payroll & Employment', task_type: 'Annual',     sort_order: 64, dates: { dec: '2027-01-31' },                                                                                   attachment_count: 2, attachment_headers: ['Signed Return', 'EFTPS Payment Proof'] },
  { code: 'W2W3',    name: 'W-2 / W-3 – Employee Wage Statements',                group_name: 'Payroll & Employment', task_type: 'Annual',     sort_order: 65, dates: { dec: '2027-01-31' },                                                                                   attachment_count: 2, attachment_headers: ['W-2 Copies', 'W-3 Transmittal'] },
  { code: '1099NEC', name: '1099-NEC – Non-Employee Compensation',                group_name: 'Payroll & Employment', task_type: 'Annual',     sort_order: 66, dates: { dec: '2027-01-31' },                                                                                   attachment_count: 2, attachment_headers: ['1099 Copies', '1096 Transmittal'] },
  { code: '1099MISC',name: '1099-MISC – Miscellaneous Income',                    group_name: 'Payroll & Employment', task_type: 'Annual',     sort_order: 67, dates: { dec: '2027-01-31' },                                                                                   attachment_count: 2, attachment_headers: ['1099 Copies', '1096 Transmittal'] },
  // International / Compliance
  { code: 'FBAR',    name: 'FinCEN 114 – FBAR (Foreign Bank Accounts)',            group_name: 'International', task_type: 'Annual FBAR',    sort_order: 80, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 1, attachment_headers: ['FBAR Confirmation'] },
  { code: 'F5471',   name: 'Form 5471 – Foreign Corporation Filing',              group_name: 'International', task_type: 'Annual',          sort_order: 81, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 2, attachment_headers: ['Signed Return', 'Supporting Schedules'] },
  { code: 'SALT',    name: 'State Income Tax Return',                             group_name: 'State Tax',     task_type: 'Annual Return',   sort_order: 90, dates: { mar: '2026-04-15' },                                                                                    attachment_count: 2, attachment_headers: ['Signed Return', 'E-file Acknowledgement'] },
]

/* ══════════════════════════════════════════════════════════════════
   UNITED KINGDOM  (CA / ACCA / ICAEW practice)
══════════════════════════════════════════════════════════════════ */
const UK_TASKS_RAW: CADefaultTask[] = [
  // VAT
  { code: 'VAT-Q1', name: 'VAT Return – Quarter 1 (MTD)',                       group_name: 'VAT',              task_type: 'Q1 Return',      sort_order: 10, dates: { may: '2026-05-07' },                                                                                    attachment_count: 2, attachment_headers: ['VAT Return Copy', 'MTD Submission Ref'] },
  { code: 'VAT-Q2', name: 'VAT Return – Quarter 2 (MTD)',                       group_name: 'VAT',              task_type: 'Q2 Return',      sort_order: 11, dates: { aug: '2026-08-07' },                                                                                    attachment_count: 2, attachment_headers: ['VAT Return Copy', 'MTD Submission Ref'] },
  { code: 'VAT-Q3', name: 'VAT Return – Quarter 3 (MTD)',                       group_name: 'VAT',              task_type: 'Q3 Return',      sort_order: 12, dates: { nov: '2026-11-07' },                                                                                    attachment_count: 2, attachment_headers: ['VAT Return Copy', 'MTD Submission Ref'] },
  { code: 'VAT-Q4', name: 'VAT Return – Quarter 4 (MTD)',                       group_name: 'VAT',              task_type: 'Q4 Return',      sort_order: 13, dates: { feb: '2027-02-07' },                                                                                    attachment_count: 2, attachment_headers: ['VAT Return Copy', 'MTD Submission Ref'] },
  // Corporation Tax
  { code: 'CT600',  name: 'Corporation Tax Return (CT600)',                      group_name: 'Corporation Tax',  task_type: 'Annual Return',  sort_order: 20, dates: { sep: '2026-09-30' },                                                                                    attachment_count: 3, attachment_headers: ['CT600 Return', 'Computations', 'Accounts'] },
  { code: 'CT-PAY', name: 'Corporation Tax Payment',                            group_name: 'Corporation Tax',  task_type: 'Payment',        sort_order: 21, dates: { aug: '2026-08-31' },                                                                                    attachment_count: 1, attachment_headers: ['Payment Confirmation'] },
  // Self Assessment / Personal
  { code: 'SA100',  name: 'Self Assessment Tax Return (SA100)',                  group_name: 'Self Assessment',  task_type: 'Annual Return',  sort_order: 30, dates: { dec: '2027-01-31' },                                                                                    attachment_count: 3, attachment_headers: ['SA100 Return', 'Submission Ref', 'Tax Calculation'] },
  { code: 'SA-POA', name: 'Self Assessment – Payments on Account (Jan)',         group_name: 'Self Assessment',  task_type: 'Payment on Account', sort_order: 31, dates: { dec: '2027-01-31' },                                                                               attachment_count: 1, attachment_headers: ['Payment Confirmation'] },
  { code: 'SA-POA2',name: 'Self Assessment – Payments on Account (Jul)',         group_name: 'Self Assessment',  task_type: 'Payment on Account', sort_order: 32, dates: { jun: '2026-07-31' },                                                                               attachment_count: 1, attachment_headers: ['Payment Confirmation'] },
  // PAYE / Payroll
  { code: 'RTI-M',  name: 'PAYE / RTI Full Payment Submission (Monthly)',        group_name: 'PAYE & Payroll',   task_type: 'Monthly FPS',    sort_order: 40, dates: { apr:'2026-04-19', may:'2026-05-19', jun:'2026-06-19', jul:'2026-07-19', aug:'2026-08-19', sep:'2026-09-19', oct:'2026-10-19', nov:'2026-11-19', dec:'2026-12-19', jan:'2027-01-19', feb:'2027-02-19', mar:'2027-03-19' }, attachment_count: 1, attachment_headers: ['FPS Submission Ref'] },
  { code: 'P60',    name: 'P60 – End of Year Employee Certificate',              group_name: 'PAYE & Payroll',   task_type: 'Annual P60',     sort_order: 41, dates: { may: '2026-05-31' },                                                                                    attachment_count: 1, attachment_headers: ['P60 Copies'] },
  { code: 'P11D',   name: 'P11D – Expenses & Benefits in Kind',                  group_name: 'PAYE & Payroll',   task_type: 'Annual P11D',    sort_order: 42, dates: { jun: '2026-07-06' },                                                                                    attachment_count: 2, attachment_headers: ['P11D Forms', 'P11D(b) Summary'] },
  // Companies House
  { code: 'CS01',   name: 'Confirmation Statement (Companies House)',             group_name: 'Companies House',  task_type: 'Annual CS01',    sort_order: 50, dates: { sep: '2026-09-30' },                                                                                    attachment_count: 1, attachment_headers: ['CS01 Filing Receipt'] },
  { code: 'AA',     name: 'Annual Accounts Filing (Companies House)',             group_name: 'Companies House',  task_type: 'Annual Accounts', sort_order: 51, dates: { sep: '2026-09-30' },                                                                                   attachment_count: 2, attachment_headers: ['Approved Accounts', 'Filing Receipt'] },
]

/* ══════════════════════════════════════════════════════════════════
   CANADA  (CPA Canada practice)
══════════════════════════════════════════════════════════════════ */
const CA_TASKS_RAW: CADefaultTask[] = [
  // Personal Tax
  { code: 'T1',     name: 'T1 – Personal Income Tax Return',                     group_name: 'Personal Tax',    task_type: 'Annual Return',  sort_order: 10, dates: { mar: '2026-04-30' },                                                                                    attachment_count: 3, attachment_headers: ['Signed T1', 'NOA Confirmation', 'Client Copy'] },
  { code: 'T1SE',   name: 'T1 – Self-Employed Tax Return (Jun 15)',              group_name: 'Personal Tax',    task_type: 'Self-Employed',  sort_order: 11, dates: { may: '2026-06-15' },                                                                                    attachment_count: 3, attachment_headers: ['Signed T1', 'NOA Confirmation', 'Client Copy'] },
  { code: 'INSTAL', name: 'Instalment Payments – Personal Tax',                  group_name: 'Personal Tax',    task_type: 'Quarterly Instalment', sort_order: 12, dates: { feb:'2026-03-15', may:'2026-06-15', aug:'2026-09-15', nov:'2026-12-15' }, attachment_count: 1, attachment_headers: ['Payment Confirmation'] },
  // Corporate Tax
  { code: 'T2',     name: 'T2 – Corporate Income Tax Return',                    group_name: 'Corporate Tax',   task_type: 'Annual Return',  sort_order: 20, dates: { may: '2026-06-30' },                                                                                    attachment_count: 3, attachment_headers: ['Signed T2', 'NOA / CRA Confirmation', 'Financial Statements'] },
  { code: 'T2INS',  name: 'Corporate Tax Instalments (Monthly)',                 group_name: 'Corporate Tax',   task_type: 'Monthly Instalment', sort_order: 21, dates: { apr:'2026-04-30', may:'2026-05-31', jun:'2026-06-30', jul:'2026-07-31', aug:'2026-08-31', sep:'2026-09-30', oct:'2026-10-31', nov:'2026-11-30', dec:'2026-12-31', jan:'2027-01-31', feb:'2027-02-28', mar:'2027-03-31' }, attachment_count: 1, attachment_headers: ['Instalment Payment Confirmation'] },
  // HST / GST
  { code: 'HSTQ1',  name: 'HST/GST Return – Q1',                                group_name: 'HST / GST',       task_type: 'Q1 Return',      sort_order: 30, dates: { may: '2026-04-30' },                                                                                    attachment_count: 2, attachment_headers: ['HST Return', 'CRA Confirmation'] },
  { code: 'HSTQ2',  name: 'HST/GST Return – Q2',                                group_name: 'HST / GST',       task_type: 'Q2 Return',      sort_order: 31, dates: { aug: '2026-07-31' },                                                                                    attachment_count: 2, attachment_headers: ['HST Return', 'CRA Confirmation'] },
  { code: 'HSTQ3',  name: 'HST/GST Return – Q3',                                group_name: 'HST / GST',       task_type: 'Q3 Return',      sort_order: 32, dates: { nov: '2026-10-31' },                                                                                    attachment_count: 2, attachment_headers: ['HST Return', 'CRA Confirmation'] },
  { code: 'HSTQ4',  name: 'HST/GST Return – Q4',                                group_name: 'HST / GST',       task_type: 'Q4 Return',      sort_order: 33, dates: { feb: '2027-01-31' },                                                                                    attachment_count: 2, attachment_headers: ['HST Return', 'CRA Confirmation'] },
  // Payroll / Information Slips
  { code: 'T4',     name: 'T4 Slips – Employment Income',                        group_name: 'Payroll & Slips', task_type: 'Annual T4',      sort_order: 40, dates: { feb: '2027-02-28' },                                                                                    attachment_count: 2, attachment_headers: ['T4 Slips', 'T4 Summary'] },
  { code: 'T4A',    name: 'T4A Slips – Other Income',                            group_name: 'Payroll & Slips', task_type: 'Annual T4A',     sort_order: 41, dates: { feb: '2027-02-28' },                                                                                    attachment_count: 2, attachment_headers: ['T4A Slips', 'T4A Summary'] },
  { code: 'T5',     name: 'T5 Slips – Investment Income',                        group_name: 'Payroll & Slips', task_type: 'Annual T5',      sort_order: 42, dates: { feb: '2027-02-28' },                                                                                    attachment_count: 2, attachment_headers: ['T5 Slips', 'T5 Summary'] },
  { code: 'PD7A',   name: 'Source Deductions Remittance (PD7A)',                 group_name: 'Payroll & Slips', task_type: 'Monthly Remittance', sort_order: 43, dates: { apr:'2026-04-15', may:'2026-05-15', jun:'2026-06-15', jul:'2026-07-15', aug:'2026-08-15', sep:'2026-09-15', oct:'2026-10-15', nov:'2026-11-15', dec:'2026-12-15', jan:'2027-01-15', feb:'2027-02-15', mar:'2027-03-15' }, attachment_count: 1, attachment_headers: ['Remittance Confirmation'] },
]

/* ══════════════════════════════════════════════════════════════════
   AUSTRALIA  (CA / CPA Australia practice)
══════════════════════════════════════════════════════════════════ */
const AU_TASKS_RAW: CADefaultTask[] = [
  // BAS
  { code: 'BAS-Q1', name: 'BAS – Q1 (Jul–Sep) Business Activity Statement',     group_name: 'BAS & IAS',       task_type: 'Q1 BAS',         sort_order: 10, dates: { oct: '2026-10-28' },                                                                                    attachment_count: 2, attachment_headers: ['BAS Lodgement Confirmation', 'ATO Receipt'] },
  { code: 'BAS-Q2', name: 'BAS – Q2 (Oct–Dec) Business Activity Statement',     group_name: 'BAS & IAS',       task_type: 'Q2 BAS',         sort_order: 11, dates: { feb: '2027-02-28' },                                                                                    attachment_count: 2, attachment_headers: ['BAS Lodgement Confirmation', 'ATO Receipt'] },
  { code: 'BAS-Q3', name: 'BAS – Q3 (Jan–Mar) Business Activity Statement',     group_name: 'BAS & IAS',       task_type: 'Q3 BAS',         sort_order: 12, dates: { apr: '2026-04-28' },                                                                                    attachment_count: 2, attachment_headers: ['BAS Lodgement Confirmation', 'ATO Receipt'] },
  { code: 'BAS-Q4', name: 'BAS – Q4 (Apr–Jun) Business Activity Statement',     group_name: 'BAS & IAS',       task_type: 'Q4 BAS',         sort_order: 13, dates: { jul: '2026-07-28' },                                                                                    attachment_count: 2, attachment_headers: ['BAS Lodgement Confirmation', 'ATO Receipt'] },
  { code: 'IAS-M',  name: 'IAS – Monthly Instalment Activity Statement',        group_name: 'BAS & IAS',       task_type: 'Monthly IAS',    sort_order: 14, dates: { apr:'2026-04-21', may:'2026-05-21', jun:'2026-06-21', jul:'2026-07-21', aug:'2026-08-21', sep:'2026-09-21', oct:'2026-10-21', nov:'2026-11-21', dec:'2026-12-21', jan:'2027-01-21', feb:'2027-02-21', mar:'2027-03-21' }, attachment_count: 1, attachment_headers: ['IAS Lodgement Confirmation'] },
  // Income Tax
  { code: 'CTR',    name: 'Company Tax Return (CTR)',                            group_name: 'Income Tax',      task_type: 'Annual CTR',     sort_order: 20, dates: { oct: '2026-10-31' },                                                                                    attachment_count: 3, attachment_headers: ['Signed Tax Return', 'ATO Lodgement Receipt', 'Financial Statements'] },
  { code: 'ITRIND', name: 'Individual Tax Return',                              group_name: 'Income Tax',      task_type: 'Annual ITR',     sort_order: 21, dates: { oct: '2026-10-31' },                                                                                    attachment_count: 3, attachment_headers: ['Signed Tax Return', 'ATO Lodgement Receipt', 'NOA'] },
  { code: 'ITRPART',name: 'Partnership Tax Return',                             group_name: 'Income Tax',      task_type: 'Annual ITR',     sort_order: 22, dates: { oct: '2026-10-31' },                                                                                    attachment_count: 3, attachment_headers: ['Signed Tax Return', 'ATO Lodgement Receipt', 'Schedule of Distribution'] },
  { code: 'ITRTRUST',name: 'Trust Tax Return',                                  group_name: 'Income Tax',      task_type: 'Annual ITR',     sort_order: 23, dates: { oct: '2026-10-31' },                                                                                    attachment_count: 3, attachment_headers: ['Signed Tax Return', 'ATO Lodgement Receipt', 'Distribution Statement'] },
  // PAYG / Payroll
  { code: 'STP',    name: 'STP – Single Touch Payroll (Annual Finalisation)',    group_name: 'Payroll & PAYG',  task_type: 'Annual STP',     sort_order: 30, dates: { jun: '2026-07-14' },                                                                                    attachment_count: 1, attachment_headers: ['STP Finalisation Declaration'] },
  { code: 'PAYG-W', name: 'PAYG Withholding Annual Report',                     group_name: 'Payroll & PAYG',  task_type: 'Annual Report',  sort_order: 31, dates: { jun: '2026-07-14' },                                                                                    attachment_count: 1, attachment_headers: ['PAYG Summary Report'] },
  // Other Obligations
  { code: 'TPAR',   name: 'TPAR – Taxable Payments Annual Report',              group_name: 'Other Compliance', task_type: 'Annual TPAR',   sort_order: 40, dates: { aug: '2026-08-28' },                                                                                    attachment_count: 1, attachment_headers: ['TPAR Lodgement Confirmation'] },
  { code: 'FBT',    name: 'FBT – Fringe Benefits Tax Return',                   group_name: 'Other Compliance', task_type: 'Annual FBT',    sort_order: 41, dates: { may: '2026-05-21' },                                                                                    attachment_count: 2, attachment_headers: ['FBT Return', 'ATO Lodgement Receipt'] },
  { code: 'SUPER',  name: 'Superannuation Guarantee Contributions (Quarterly)',  group_name: 'Other Compliance', task_type: 'Quarterly Super', sort_order: 42, dates: { may:'2026-04-28', aug:'2026-07-28', nov:'2026-10-28', feb:'2027-01-28' }, attachment_count: 1, attachment_headers: ['SuperStream / APRA Confirmation'] },
  { code: 'ASIC',   name: 'ASIC – Annual Company Review (Solvency Statement)',  group_name: 'Other Compliance', task_type: 'Annual ASIC',   sort_order: 43, dates: { aug: '2026-08-31' },                                                                                    attachment_count: 2, attachment_headers: ['ASIC Annual Statement', 'Solvency Declaration'] },
]

/* ══════════════════════════════════════════════════════════════════
   EUROPE  (general EU / cross-border practice)
══════════════════════════════════════════════════════════════════ */
const EU_TASKS_RAW: CADefaultTask[] = [
  // VAT
  { code: 'VAT-M',  name: 'VAT Return – Monthly Filing',                         group_name: 'VAT',              task_type: 'Monthly Return', sort_order: 10, dates: { apr:'2026-04-20', may:'2026-05-20', jun:'2026-06-20', jul:'2026-07-20', aug:'2026-08-20', sep:'2026-09-20', oct:'2026-10-20', nov:'2026-11-20', dec:'2026-12-20', jan:'2027-01-20', feb:'2027-02-20', mar:'2027-03-20' }, attachment_count: 2, attachment_headers: ['VAT Return', 'Submission Reference'] },
  { code: 'VAT-Q',  name: 'VAT Return – Quarterly Filing',                       group_name: 'VAT',              task_type: 'Quarterly',      sort_order: 11, dates: { apr:'2026-04-20', jul:'2026-07-20', oct:'2026-10-20', jan:'2027-01-20' },  attachment_count: 2, attachment_headers: ['VAT Return', 'Submission Reference'] },
  { code: 'ECSL',   name: 'EC Sales List (Recapitulative Statement)',             group_name: 'VAT',              task_type: 'Monthly ECSL',   sort_order: 12, dates: { apr:'2026-04-20', may:'2026-05-20', jun:'2026-06-20', jul:'2026-07-20', aug:'2026-08-20', sep:'2026-09-20', oct:'2026-10-20', nov:'2026-11-20', dec:'2026-12-20', jan:'2027-01-20', feb:'2027-02-20', mar:'2027-03-20' }, attachment_count: 1, attachment_headers: ['ECSL Submission Reference'] },
  { code: 'INTRA',  name: 'Intrastat Declaration',                               group_name: 'VAT',              task_type: 'Monthly Intrastat', sort_order: 13, dates: { apr:'2026-04-23', may:'2026-05-23', jun:'2026-06-23', jul:'2026-07-23', aug:'2026-08-23', sep:'2026-09-23', oct:'2026-10-23', nov:'2026-11-23', dec:'2026-12-23', jan:'2027-01-23', feb:'2027-02-23', mar:'2027-03-23' }, attachment_count: 1, attachment_headers: ['Intrastat Declaration Reference'] },
  // Corporate Tax
  { code: 'CIT',    name: 'Corporate Income Tax Return (Annual)',                 group_name: 'Corporate Tax',    task_type: 'Annual CIT',     sort_order: 20, dates: { may: '2026-06-30' },                                                                                    attachment_count: 3, attachment_headers: ['Tax Return', 'Financial Statements', 'Submission Receipt'] },
  { code: 'CIT-ADV',name: 'Corporate Tax Advance Payment',                       group_name: 'Corporate Tax',    task_type: 'Advance Payment', sort_order: 21, dates: { apr:'2026-04-10', jun:'2026-06-10', sep:'2026-09-10', dec:'2026-12-10' }, attachment_count: 1, attachment_headers: ['Payment Confirmation'] },
  // Annual Accounts
  { code: 'ANNREP', name: 'Annual Accounts Filing (Statutory Register)',          group_name: 'Annual Accounts',  task_type: 'Annual Filing',  sort_order: 30, dates: { may: '2026-05-31' },                                                                                    attachment_count: 3, attachment_headers: ['Approved Accounts', 'Auditor\'s Report', 'Filing Receipt'] },
  { code: 'STAT',   name: 'Statutory Audit Engagement',                         group_name: 'Annual Accounts',  task_type: 'Audit',          sort_order: 31, dates: { apr: '2026-04-30' },                                                                                    attachment_count: 3, attachment_headers: ['Audit Report', 'Management Letter', 'Engagement Letter'] },
  // Payroll
  { code: 'PAY-M',  name: 'Payroll Tax / Social Security Monthly',               group_name: 'Payroll',          task_type: 'Monthly Payroll', sort_order: 40, dates: { apr:'2026-04-19', may:'2026-05-19', jun:'2026-06-19', jul:'2026-07-19', aug:'2026-08-19', sep:'2026-09-19', oct:'2026-10-19', nov:'2026-11-19', dec:'2026-12-19', jan:'2027-01-19', feb:'2027-02-19', mar:'2027-03-19' }, attachment_count: 2, attachment_headers: ['Payroll Register', 'Payment Confirmation'] },
  // Transfer Pricing
  { code: 'TP',     name: 'Transfer Pricing Documentation',                      group_name: 'Transfer Pricing', task_type: 'Annual TP',      sort_order: 50, dates: { oct: '2026-10-31' },                                                                                    attachment_count: 2, attachment_headers: ['TP Documentation', 'Benchmarking Study'] },
  { code: 'CBCR',   name: 'Country-by-Country Report (CbCR) – MNEs',            group_name: 'Transfer Pricing', task_type: 'Annual CbCR',    sort_order: 51, dates: { dec: '2026-12-31' },                                                                                    attachment_count: 1, attachment_headers: ['CbCR Submission Confirmation'] },
]

/* ══════════════════════════════════════════════════════════════════
   Exported registry
══════════════════════════════════════════════════════════════════ */

export const COUNTRY_TASK_SETS: CountryTaskSet[] = [
  {
    code: 'IN',
    name: 'India (CA/CMA)',
    flag: '🇮🇳',
    description: 'GST, TDS, Income Tax, ROC / Company Law, Audit, Labour & Payroll',
    tasks: INDIA_TASKS,
  },
  {
    code: 'US',
    name: 'United States (CPA)',
    flag: '🇺🇸',
    description: 'Federal & State Returns, Estimated Tax, Payroll (941/940/W-2/1099), FBAR',
    tasks: prefixed('US', US_TASKS_RAW),
  },
  {
    code: 'UK',
    name: 'United Kingdom (CA/ACCA)',
    flag: '🇬🇧',
    description: 'VAT (MTD), Corporation Tax CT600, Self Assessment, PAYE/RTI, Companies House',
    tasks: prefixed('UK', UK_TASKS_RAW),
  },
  {
    code: 'CA',
    name: 'Canada (CPA Canada)',
    flag: '🇨🇦',
    description: 'T1/T2 Returns, HST/GST, T4/T4A/T5 Slips, Source Deductions',
    tasks: prefixed('CA', CA_TASKS_RAW),
  },
  {
    code: 'AU',
    name: 'Australia (CA/CPA)',
    flag: '🇦🇺',
    description: 'BAS/IAS, Company Tax Return, STP, TPAR, FBT, Super, ASIC',
    tasks: prefixed('AU', AU_TASKS_RAW),
  },
  {
    code: 'EU',
    name: 'Europe (General EU)',
    flag: '🇪🇺',
    description: 'VAT, ECSL, Intrastat, Corporate Income Tax, Annual Accounts, Transfer Pricing',
    tasks: prefixed('EU', EU_TASKS_RAW),
  },
]

export function getTasksForCountries(countryCodes: string[]): CADefaultTask[] {
  const result: CADefaultTask[] = []
  for (const code of countryCodes) {
    const set = COUNTRY_TASK_SETS.find(s => s.code === code)
    if (set) result.push(...set.tasks)
  }
  return result
}
