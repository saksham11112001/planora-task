/**
 * Recurrence maths — the highest-consequence pure module in the app.
 * A bug here means a statutory deadline lands on the wrong date.
 *
 * Run: npm test
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidGranularFrequency,
  normalizeFrequency,
  shiftDays,
  inferGranularFrequency,
  nextOccurrence,
} from '../lib/utils/recurringSchedule.ts'

describe('normalizeFrequency — granular → tasks.frequency DB enum', () => {
  // CLAUDE.md critical rule #7: the DB column only accepts the enum values.
  const DB_ENUM = ['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'half_yearly', 'annual']

  test('maps every granular family to its enum value', () => {
    assert.equal(normalizeFrequency('weekly_mon'), 'weekly')
    assert.equal(normalizeFrequency('weekly_sun'), 'weekly')
    assert.equal(normalizeFrequency('weekly_days:mon,wed,fri'), 'weekly')
    assert.equal(normalizeFrequency('monthly_15'), 'monthly')
    assert.equal(normalizeFrequency('monthly_last'), 'monthly')
    assert.equal(normalizeFrequency('monthly_days:1,15,25'), 'monthly')
    assert.equal(normalizeFrequency('quarterly_13'), 'quarterly')
    assert.equal(normalizeFrequency('quarterly_last'), 'quarterly')
    assert.equal(normalizeFrequency('annual_31jul'), 'annual')
    assert.equal(normalizeFrequency('annual_31mar'), 'annual')
  })

  test('leaves base frequencies untouched', () => {
    for (const f of DB_ENUM) assert.equal(normalizeFrequency(f), f)
  })

  test('output is always a legal DB enum value for every valid input', () => {
    const samples = [
      'daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'half_yearly', 'annual',
      'weekly_mon', 'weekly_tue', 'weekly_wed', 'weekly_thu', 'weekly_fri', 'weekly_sat', 'weekly_sun',
      'weekly_days:mon,fri', 'monthly_1', 'monthly_7', 'monthly_31', 'monthly_last',
      'monthly_days:1,15', 'quarterly_13', 'quarterly_25', 'quarterly_last',
      'annual_31jul', 'annual_30sep', 'annual_31dec', 'annual_31mar',
    ]
    for (const f of samples) {
      assert.ok(DB_ENUM.includes(normalizeFrequency(f)), `${f} → ${normalizeFrequency(f)} is not a DB enum value`)
    }
  })

  test('every_N_days is NOT normalised — it would violate the DB enum', () => {
    // Documents a real constraint: callers must not write this straight to the
    // frequency column. Kept as an explicit assertion so the day someone
    // "fixes" normalizeFrequency, this test explains why it mattered.
    assert.equal(normalizeFrequency('every_3_days'), 'every_3_days')
    assert.ok(!DB_ENUM.includes(normalizeFrequency('every_3_days')))
  })
})

describe('isValidGranularFrequency', () => {
  test('accepts every documented pattern', () => {
    const valid = [
      'daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'half_yearly', 'annual',
      'every_1_days', 'every_15_days',
      'weekly_mon', 'weekly_sun', 'weekly_days:mon', 'weekly_days:mon,wed,fri',
      'monthly_1', 'monthly_31', 'monthly_last', 'monthly_days:1,15,25',
      'quarterly_1', 'quarterly_25', 'quarterly_last',
      'annual_31jul', 'annual_30sep', 'annual_31dec', 'annual_31mar', 'annual_15aug',
    ]
    for (const f of valid) assert.ok(isValidGranularFrequency(f), `expected valid: ${f}`)
  })

  test('rejects malformed and empty input', () => {
    const invalid = [
      '', 'nonsense', 'weekly_xyz', 'monthly_', 'monthly_days:', 'every_days',
      'annual_32xyz', 'quarterly_', 'WEEKLY_MON', 'weekly_days:funday',
    ]
    for (const f of invalid) assert.ok(!isValidGranularFrequency(f), `expected invalid: ${f}`)
  })

  test('does not throw on non-string input', () => {
    assert.equal(isValidGranularFrequency(undefined as unknown as string), false)
    assert.equal(isValidGranularFrequency(null as unknown as string), false)
  })
})

describe('shiftDays', () => {
  test('shifts forward and backward', () => {
    assert.equal(shiftDays('2026-08-04', 1), '2026-08-05')
    assert.equal(shiftDays('2026-08-04', -1), '2026-08-03')
    assert.equal(shiftDays('2026-08-04', 0), '2026-08-04')
  })

  test('crosses month and year boundaries', () => {
    assert.equal(shiftDays('2026-08-31', 1), '2026-09-01')
    assert.equal(shiftDays('2026-09-01', -1), '2026-08-31')
    assert.equal(shiftDays('2026-12-31', 1), '2027-01-01')
    assert.equal(shiftDays('2027-01-01', -1), '2026-12-31')
  })

  test('handles leap and non-leap February', () => {
    assert.equal(shiftDays('2028-02-28', 1), '2028-02-29')  // 2028 is a leap year
    assert.equal(shiftDays('2026-02-28', 1), '2026-03-01')  // 2026 is not
  })

  test('is stable under a large shift (CA lead times reach 90+ days)', () => {
    assert.equal(shiftDays('2026-12-31', -90), '2026-10-02')
    assert.equal(shiftDays('2026-01-01', 365), '2027-01-01')
  })

  test('never drifts a day from timezone round-tripping', () => {
    // The module parses to LOCAL midnight precisely to avoid the UTC bug where
    // toISOString() returns the previous calendar day for UTC+5:30.
    for (let i = 0; i < 400; i++) {
      const out = shiftDays('2026-01-01', i)
      const back = shiftDays(out, -i)
      assert.equal(back, '2026-01-01', `round-trip failed at +${i} days (got ${out})`)
    }
  })
})

describe('nextOccurrence — annual fixed dates', () => {
  test('returns this year when the date is still ahead', () => {
    assert.equal(nextOccurrence('annual_31jul', '2026-01-15'), '2026-07-31')
    assert.equal(nextOccurrence('annual_30sep', '2026-01-15'), '2026-09-30')
    assert.equal(nextOccurrence('annual_31dec', '2026-01-15'), '2026-12-31')
    assert.equal(nextOccurrence('annual_31mar', '2026-01-15'), '2026-03-31')
  })

  test('rolls to next year once the date has passed', () => {
    assert.equal(nextOccurrence('annual_31jul', '2026-08-01'), '2027-07-31')
    assert.equal(nextOccurrence('annual_31mar', '2026-04-01'), '2027-03-31')
    assert.equal(nextOccurrence('annual_31dec', '2026-12-31'), '2027-12-31')
  })

  test('the due date itself is never returned — strictly the NEXT one', () => {
    // Guards the spawn loop against re-spawning the same instance forever.
    assert.equal(nextOccurrence('annual_31jul', '2026-07-31'), '2027-07-31')
  })
})

describe('nextOccurrence — monthly', () => {
  test('fixed day of month', () => {
    assert.equal(nextOccurrence('monthly_15', '2026-08-01'), '2026-08-15')
    assert.equal(nextOccurrence('monthly_15', '2026-08-15'), '2026-09-15')
    assert.equal(nextOccurrence('monthly_15', '2026-08-20'), '2026-09-15')
  })

  test('clamps to the last day in short months', () => {
    // GST/TDS deadlines land on the 31st; February must not overflow to March.
    assert.equal(nextOccurrence('monthly_31', '2026-01-31'), '2026-02-28')
    assert.equal(nextOccurrence('monthly_31', '2028-01-31'), '2028-02-29') // leap
    assert.equal(nextOccurrence('monthly_30', '2026-01-31'), '2026-02-28')
  })

  test('monthly_last resolves to each month end', () => {
    assert.equal(nextOccurrence('monthly_last', '2026-08-01'), '2026-08-31')
    assert.equal(nextOccurrence('monthly_last', '2026-08-31'), '2026-09-30')
    assert.equal(nextOccurrence('monthly_last', '2026-01-31'), '2026-02-28')
  })

  test('crosses the year boundary', () => {
    assert.equal(nextOccurrence('monthly_15', '2026-12-20'), '2027-01-15')
  })

  test('multi-day monthly picks the next day in the list, then rolls over', () => {
    assert.equal(nextOccurrence('monthly_days:1,15,25', '2026-08-02'), '2026-08-15')
    assert.equal(nextOccurrence('monthly_days:1,15,25', '2026-08-16'), '2026-08-25')
    assert.equal(nextOccurrence('monthly_days:1,15,25', '2026-08-26'), '2026-09-01')
    assert.equal(nextOccurrence('monthly_days:1,15,25', '2026-12-26'), '2027-01-01')
  })

  test('multi-day monthly is order-independent', () => {
    assert.equal(nextOccurrence('monthly_days:25,1,15', '2026-08-02'), '2026-08-15')
  })
})

describe('nextOccurrence — quarterly', () => {
  test('lands only on quarter-end months (Mar/Jun/Sep/Dec)', () => {
    const QUARTER_END_MONTHS = ['03', '06', '09', '12']
    for (const from of ['2026-01-05', '2026-04-10', '2026-07-20', '2026-10-30', '2026-12-26']) {
      const got = nextOccurrence('quarterly_25', from)
      assert.ok(QUARTER_END_MONTHS.includes(got.slice(5, 7)), `${from} → ${got} is not a quarter-end month`)
      assert.ok(got > from, `${from} → ${got} is not in the future`)
    }
  })

  test('fixed day within the quarter-end month', () => {
    assert.equal(nextOccurrence('quarterly_25', '2026-01-05'), '2026-03-25')
    assert.equal(nextOccurrence('quarterly_25', '2026-03-25'), '2026-06-25')
  })

  test('quarterly_last resolves to the quarter-end month end', () => {
    assert.equal(nextOccurrence('quarterly_last', '2026-01-05'), '2026-03-31')
    assert.equal(nextOccurrence('quarterly_last', '2026-03-31'), '2026-06-30')
  })
})

describe('nextOccurrence — weekly', () => {
  test('fixed weekday always lands on that weekday, strictly ahead', () => {
    const DAY_INDEX: Record<string, number> = {
      weekly_sun: 0, weekly_mon: 1, weekly_tue: 2, weekly_wed: 3,
      weekly_thu: 4, weekly_fri: 5, weekly_sat: 6,
    }
    // 2026-08-04 is a Tuesday.
    for (const [freq, idx] of Object.entries(DAY_INDEX)) {
      const got = nextOccurrence(freq, '2026-08-04')
      const [y, m, d] = got.split('-').map(Number)
      assert.equal(new Date(y, m - 1, d).getDay(), idx, `${freq} → ${got} is the wrong weekday`)
      assert.ok(got > '2026-08-04', `${freq} → ${got} must be strictly ahead`)
    }
  })

  test('same weekday rolls a full week forward, never returns today', () => {
    assert.equal(nextOccurrence('weekly_tue', '2026-08-04'), '2026-08-11') // Tue → next Tue
  })

  test('multi-day weekly picks the next listed day, then wraps', () => {
    // 2026-08-04 Tue → next in {mon,wed,fri} is Wed 05
    assert.equal(nextOccurrence('weekly_days:mon,wed,fri', '2026-08-04'), '2026-08-05')
    // Fri 07 → wraps to Mon 10
    assert.equal(nextOccurrence('weekly_days:mon,wed,fri', '2026-08-07'), '2026-08-10')
  })
})

describe('nextOccurrence — interval frequencies', () => {
  test('every_N_days', () => {
    assert.equal(nextOccurrence('every_3_days', '2026-08-04'), '2026-08-07')
    assert.equal(nextOccurrence('every_15_days', '2026-08-20'), '2026-09-04')
    assert.equal(nextOccurrence('every_1_days', '2026-12-31'), '2027-01-01')
  })

  test('base frequencies advance by their period', () => {
    assert.equal(nextOccurrence('daily', '2026-08-04'), '2026-08-05')
    assert.equal(nextOccurrence('weekly', '2026-08-04'), '2026-08-11')
    assert.equal(nextOccurrence('bi_weekly', '2026-08-04'), '2026-08-18')
    assert.equal(nextOccurrence('monthly', '2026-08-04'), '2026-09-04')
    assert.equal(nextOccurrence('quarterly', '2026-08-04'), '2026-11-04')
    assert.equal(nextOccurrence('half_yearly', '2026-08-04'), '2027-02-04')
    assert.equal(nextOccurrence('annual', '2026-08-04'), '2027-08-04')
  })

  test('unknown frequency falls back to +7 days rather than throwing', () => {
    assert.equal(nextOccurrence('totally_unknown', '2026-08-04'), '2026-08-11')
  })
})

describe('nextOccurrence — invariants across every frequency', () => {
  const ALL = [
    'daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'half_yearly', 'annual',
    'every_3_days', 'weekly_mon', 'weekly_fri', 'weekly_days:mon,wed,fri',
    'monthly_1', 'monthly_15', 'monthly_31', 'monthly_last', 'monthly_days:1,15,25',
    'quarterly_13', 'quarterly_last', 'annual_31jul', 'annual_30sep', 'annual_31dec', 'annual_31mar',
  ]

  test('always returns a strictly future, well-formed date', () => {
    // Walk a full year of reference dates so month-length and leap-day edges
    // are all exercised, not just the handful picked by hand above.
    for (const freq of ALL) {
      for (let i = 0; i < 366; i++) {
        const from = shiftDays('2028-01-01', i)  // 2028 is a leap year
        const got = nextOccurrence(freq, from)
        assert.match(got, /^\d{4}-\d{2}-\d{2}$/, `${freq} from ${from} → malformed ${got}`)
        assert.ok(got > from, `${freq} from ${from} → ${got} is not strictly future`)
        const [y, m, d] = got.split('-').map(Number)
        const realDay = new Date(y, m - 1, d)
        assert.equal(realDay.getMonth(), m - 1, `${freq} from ${from} → ${got} is not a real calendar date`)
        assert.equal(realDay.getDate(), d, `${freq} from ${from} → ${got} overflowed its month`)
      }
    }
  })

  test('iterating never stalls or goes backwards', () => {
    // The spawn cron advances from the previous occurrence; a non-advancing
    // result would spawn the same task forever.
    for (const freq of ALL) {
      let cursor = '2026-01-01'
      for (let n = 0; n < 24; n++) {
        const next = nextOccurrence(freq, cursor)
        assert.ok(next > cursor, `${freq} stalled at ${cursor} → ${next}`)
        cursor = next
      }
    }
  })
})

describe('inferGranularFrequency', () => {
  test('infers the weekday from a weekly date', () => {
    assert.equal(inferGranularFrequency('weekly', '2026-08-04'), 'weekly_tue')
    assert.equal(inferGranularFrequency('weekly', '2026-08-09'), 'weekly_sun')
  })

  test('infers day-of-month, preferring monthly_last at month end', () => {
    assert.equal(inferGranularFrequency('monthly', '2026-08-15'), 'monthly_15')
    assert.equal(inferGranularFrequency('monthly', '2026-08-31'), 'monthly_last')
    assert.equal(inferGranularFrequency('monthly', '2026-02-28'), 'monthly_last')
  })

  test('infers quarterly and annual variants', () => {
    assert.equal(inferGranularFrequency('quarterly', '2026-03-25'), 'quarterly_25')
    assert.equal(inferGranularFrequency('quarterly', '2026-03-31'), 'quarterly_last')
    assert.equal(inferGranularFrequency('annual', '2026-07-31'), 'annual_31jul')
  })

  test('falls back to the base frequency when nothing can be inferred', () => {
    assert.equal(inferGranularFrequency('daily', '2026-08-04'), 'daily')
    assert.equal(inferGranularFrequency('weekly', ''), 'weekly')
    assert.equal(inferGranularFrequency('', '2026-08-04'), '')
  })

  test('round-trips: inferred value normalises back to the original enum', () => {
    for (const [base, date] of [
      ['weekly', '2026-08-04'], ['monthly', '2026-08-15'],
      ['quarterly', '2026-03-25'], ['annual', '2026-07-31'],
    ] as const) {
      assert.equal(normalizeFrequency(inferGranularFrequency(base, date)), base)
    }
  })
})
