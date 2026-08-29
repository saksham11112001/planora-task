# Migrations — how to apply

There is no automated migration runner. **Every file in this folder must be run
manually in the Supabase SQL editor (production project) when it lands on
`main`.** All files are written to be idempotent (`IF NOT EXISTS` / guarded), so
re-running a file is safe.

> Schema-drift incidents to date (all "code shipped, migration not applied"):
> `clients.is_archived` (clients page 500s), `client_notices` +
> `client_credentials` (client detail page errors), withdrawal unique indexes.
> When a deploy references a new table/column, apply the migration FIRST.

## Quick check for drift

Run in BOTH your local/dev and production SQL editors and diff the output:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

## Recently added (verify these are applied in production)

- `20260608_client_notices.sql` — Notices & Correspondence table
- `20260608_client_credentials.sql` — Portal Credentials table
- `add_clients_soft_delete.sql` — clients.is_archived / deleted_at
- `prevent_duplicate_pending_withdrawals.sql` — partner payout race guards
- `add_msme_consent.sql` — DPDP consent timestamp
- `add_engagement_emails.sql` — marketing_email_log + users.marketing_opt_out
- `add_bni_coupon.sql` — seeds the BNI coupon (1 free year of the Starter
  pack, once per org). Safe to run any time; the code does nothing until the
  annual-term deploy ships.
- **MSME packs became annual — read before deploying.** No migration is
  needed, but the change is retroactive: entitlement is now derived from
  `expires_at`, falling back to `paid_at + 1 year` for rows bought before the
  term existed. Any org whose payment is more than 12 months old drops to the
  free 5-vendor tier the moment this deploys. Check who that is FIRST:

  ```sql
  SELECT o.id, o.name,
         s.config->>'tier'    AS tier,
         s.config->>'paid_at' AS paid_at,
         (s.config->>'paid_at')::timestamptz + interval '1 year' AS access_ends
  FROM   org_feature_settings s
  JOIN   organisations o ON o.id = s.org_id
  WHERE  s.feature_key = 'msme_pack'
    AND  COALESCE(s.config->>'tier', 'free') <> 'free'
    AND  s.config->>'expires_at' IS NULL
  ORDER  BY access_ends;
  ```

  Rows with `access_ends` in the past lose access on deploy. If that set is
  not empty and you would rather extend them, stamp an explicit date first —
  this gives everyone 12 months from today instead:

  ```sql
  UPDATE org_feature_settings
  SET    config = config || jsonb_build_object('expires_at', (now() + interval '1 year')::text)
  WHERE  feature_key = 'msme_pack'
    AND  COALESCE(config->>'tier', 'free') <> 'free'
    AND  config->>'expires_at' IS NULL;
  ```
- `add_ca_assignment_date_bounds.sql` — `ca_client_assignments.start_date` /
  `.end_date`. **Required before the end-date deploy**, or Step 2 saves will
  fail on the missing column. Also back-fills the record for `start_date`,
  which production has but no migration ever declared.
- `add_tasks_parent_task_id_index.sql` — **apply this one first.** Index on
  `tasks(parent_task_id, status)`. Without it, PATCH `/api/tasks/[id]` scans
  every task row in the organisation on each completion and eventually trips
  the statement timeout. Pure index addition — no schema or data change, and
  safe to apply ahead of any deploy. Uses `CREATE INDEX CONCURRENTLY`, so run
  the file on its own (not inside a transaction).
