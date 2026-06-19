ALTER TABLE inquiries ADD COLUMN source_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_inquiries_source_ip_created_at
ON inquiries(source_ip, created_at);

CREATE INDEX IF NOT EXISTS idx_inquiries_email_created_at
ON inquiries(email, created_at);
