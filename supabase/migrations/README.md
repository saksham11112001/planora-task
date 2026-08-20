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
