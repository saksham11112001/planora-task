-- Indexes for msme_email_log to support org-scoped queries efficiently
-- org_id is the primary filter on all list/count queries against this table

CREATE INDEX IF NOT EXISTS msme_email_log_org_id_idx
  ON msme_email_log (org_id);

CREATE INDEX IF NOT EXISTS msme_email_log_vendor_id_idx
  ON msme_email_log (vendor_id);
