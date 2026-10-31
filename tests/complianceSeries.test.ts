/**
 * The Compliance / Other Tasks daily series.
 *
 * These four lines are read as a trend by a firm every morning, and until this
 * module was extracted they had no tests at all — the arithmetic lived in a
 * .tsx file the node test runner cannot import.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildComplianceData, wasOpenOn, isRecurringTemplate,
} from '../lib/reports/complianceSeries.ts'
import type { ComplianceRawTask } from '../lib/reports/complianceSeries.ts'

/** Timezone-independent day string, matching lib/utils/format's shape. */
const dayStr = (d: Date) => d.toISOString().slice(0, 10)
const NOW = new Date('2026-10-31T12:00:00Z')

const task = (o: Partial<ComplianceRawTask> = {}): ComplianceRawTask => ({
  id: 't1', title: 'Task', status: 'todo', priority: 'medium',
  due_date: null, created_at: '2026-10-01T09:00:00Z', completed_at: null,
  custom_fields: {}, assignee_id: null, client_id: null,
  is_recurring: null, parent_recurring_id: null, ...o,
})

/* ── wasOpenOn: the question the old code never asked ────────────────────── */

describe('wasOpenOn', () => {
  test('a task is not open before it was created', () => {
    const t = task({ created_at: '2026-10-20T09:00:00Z' })
    assert.equal(wasOpenOn(t, '2026-10-19'), false)
    assert.equal(wasOpenOn(t, '2026-10-20'), true)
  })

  test('a completed task is open up to the day it was finished, then not', () => {
    // THE REGRESSION. Reading today's status made finished work vanish from
    // the whole history, so the chart could not show a backlog being cleared.
    const t = task({ status: 'completed', completed_at: '2026-10-25T14:00:00Z' })
    assert.equal(wasOpenOn(t, '2026-10-24'), true,  'still open the day before')
    assert.equal(wasOpenOn(t, '2026-10-25'), false, 'closed on the day itself')
    assert.equal(wasOpenOn(t, '2026-10-26'), false)
  })

  test('an open task stays open on every day since creation', () => {
    const t = task()
    assert.equal(wasOpenOn(t, '2026-10-01'), true)
    assert.equal(wasOpenOn(t, '2026-10-31'), true)
  })

  test('a cancelled task is excluded from every day', () => {
    // There is no cancelled_at, so it cannot be placed in time. Excluding it
    // under-reports rather than inflating a backlog with a guess.
    const t = task({ status: 'cancelled' })
    assert.equal(wasOpenOn(t, '2026-10-02'), false)
    assert.equal(wasOpenOn(t, '2026-10-31'), false)
  })

  test('completed with no timestamp is treated as closed, not open for ever', () => {
    const t = task({ status: 'completed', completed_at: null })
    assert.equal(wasOpenOn(t, '2026-10-31'), false)
  })
})

/* ── the series itself ───────────────────────────────────────────────────── */

describe('buildComplianceData — history is real history', () => {
  test('No Due Date falls on the day the task was completed', () => {
    const tasks = [task({ id: 'a', due_date: null, status: 'completed', completed_at: '2026-10-29T10:00:00Z' })]
    const { daily } = buildComplianceData(tasks, 5, '', dayStr, NOW)   // 27..31 Oct
    const on = (d: string) => daily.find(x => x.dateKey === d)!.noDueDateNC
    assert.equal(on('2026-10-28'), 1, 'open before it was finished')
    assert.equal(on('2026-10-29'), 0, 'closed from that day')
    assert.equal(on('2026-10-31'), 0)
  })

  test('Overdue no longer only climbs — clearing a backlog shows', () => {
    const tasks = [
      task({ id: 'a', due_date: '2026-10-20', status: 'completed', completed_at: '2026-10-29T10:00:00Z' }),
      task({ id: 'b', due_date: '2026-10-20' }),
    ]
    const { daily } = buildComplianceData(tasks, 5, '', dayStr, NOW)
    const on = (d: string) => daily.find(x => x.dateKey === d)!.overdueNC
    assert.equal(on('2026-10-28'), 2, 'both overdue')
    assert.equal(on('2026-10-29'), 1, 'one cleared')
    assert.equal(on('2026-10-31'), 1)
  })

  test('a task created after a day is not reported overdue on it', () => {
    // The old overdue filter never checked created_at at all.
    const tasks = [task({ id: 'a', due_date: '2026-10-05', created_at: '2026-10-30T09:00:00Z' })]
    const { daily } = buildComplianceData(tasks, 5, '', dayStr, NOW)
    assert.equal(daily.find(x => x.dateKey === '2026-10-28')!.overdueNC, 0)
    assert.equal(daily.find(x => x.dateKey === '2026-10-30')!.overdueNC, 1)
  })

  test('CA and non-CA tasks land on their own series, never both', () => {
    // "Non-Compliance" never meant "non-compliant" -- it is everything that is
    // not a CA compliance task. The split is by custom_fields, nothing else.
    const tasks = [
      task({ id: 'ca', custom_fields: { _ca_compliance: true } }),
      task({ id: 'nc', custom_fields: {} }),
      task({ id: 'nofields', custom_fields: null }),
    ]
    const { summary } = buildComplianceData(tasks, 3, '', dayStr, NOW)
    assert.equal(summary.noDueDateC, 1)
    assert.equal(summary.noDueDateNC, 2, 'null custom_fields counts as not-CA')
  })

  test('repeat templates are excluded from every figure', () => {
    const tasks = [
      task({ id: 'tpl', is_recurring: true, parent_recurring_id: null }),
      task({ id: 'occ', is_recurring: false, parent_recurring_id: 'tpl' }),
    ]
    const { summary, daily } = buildComplianceData(tasks, 3, '', dayStr, NOW)
    assert.equal(summary.noDueDateNC, 1, 'the occurrence counts, the template does not')
    assert.equal(summary.pendingNC, 1)
    assert.equal(daily.at(-1)!.noDueDateNC, 1)
  })

  test('an ordinary task with is_recurring null is not mistaken for a template', () => {
    // `is_recurring === true` is deliberate: most rows carry null, and a
    // loose check would drop every ordinary task from the chart.
    assert.equal(isRecurringTemplate(task({ is_recurring: null })), false)
    assert.equal(isRecurringTemplate(task({ is_recurring: undefined })), false)
    assert.equal(isRecurringTemplate(task({ is_recurring: true })), true)
  })

  test('the member filter narrows every series', () => {
    const tasks = [
      task({ id: 'mine',   assignee_id: 'u1' }),
      task({ id: 'theirs', assignee_id: 'u2' }),
    ]
    assert.equal(buildComplianceData(tasks, 3, 'u1', dayStr, NOW).summary.noDueDateNC, 1)
    assert.equal(buildComplianceData(tasks, 3, '',   dayStr, NOW).summary.noDueDateNC, 2)
  })

  test('Added and Completed stay pinned to their own dates', () => {
    const tasks = [task({ created_at: '2026-10-29T08:00:00Z', completed_at: '2026-10-30T16:00:00Z', status: 'completed' })]
    const { daily } = buildComplianceData(tasks, 5, '', dayStr, NOW)
    assert.equal(daily.find(x => x.dateKey === '2026-10-29')!.addedNC, 1)
    assert.equal(daily.find(x => x.dateKey === '2026-10-30')!.completedNC, 1)
    assert.equal(daily.find(x => x.dateKey === '2026-10-29')!.completedNC, 0)
  })

  test('today’s summary still reflects current state', () => {
    const tasks = [
      task({ id: 'a', due_date: '2026-10-01' }),
      task({ id: 'b', due_date: '2026-10-01', status: 'completed', completed_at: '2026-10-30T10:00:00Z' }),
      task({ id: 'c', due_date: null }),
    ]
    const { summary } = buildComplianceData(tasks, 3, '', dayStr, NOW)
    assert.equal(summary.overdueNC, 1, 'the completed one is not overdue')
    assert.equal(summary.noDueDateNC, 1)
    assert.equal(summary.pendingNC, 2)
  })

  test('the series has one point per day, oldest first', () => {
    const { daily } = buildComplianceData([], 7, '', dayStr, NOW)
    assert.equal(daily.length, 7)
    assert.equal(daily[0].dateKey, '2026-10-25')
    assert.equal(daily.at(-1)!.dateKey, '2026-10-31')
  })

  test('an empty task list yields zeroes, not a throw', () => {
    const { daily, summary } = buildComplianceData([], 3, '', dayStr, NOW)
    assert.equal(daily.every(d => d.overdueC + d.overdueNC + d.noDueDateC + d.noDueDateNC === 0), true)
    assert.equal(summary.pendingC, 0)
    assert.equal(summary.pendingNC, 0)
  })
})
