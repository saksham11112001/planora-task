-- Country / locale settings per org.
-- Stores { "country": "IN" } — drives currency, timezone, date formats and
-- per-country plan pricing. Default IN (launch market: ICAI / CA firms).
alter table org_settings
  add column if not exists locale jsonb default '{"country": "IN"}'::jsonb;
