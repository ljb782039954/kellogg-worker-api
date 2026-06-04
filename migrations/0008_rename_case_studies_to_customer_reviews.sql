-- Migration: 0008_rename_case_studies_to_customer_reviews.sql
-- Rename case_studies table back to customer_reviews and recreate indexes

-- Rename table
ALTER TABLE case_studies RENAME TO customer_reviews;

-- Drop old indexes
DROP INDEX IF EXISTS idx_case_studies_status;
DROP INDEX IF EXISTS idx_case_studies_sort;

-- Recreate indexes on new table
CREATE INDEX IF NOT EXISTS idx_customer_reviews_status ON customer_reviews(status);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_sort ON customer_reviews(sort_order);
