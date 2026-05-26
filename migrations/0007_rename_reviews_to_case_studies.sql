-- Migration: 0007_rename_reviews_to_case_studies.sql
-- Rename customer_reviews table to case_studies and recreate indexes

-- Rename table
ALTER TABLE customer_reviews RENAME TO case_studies;

-- Drop old indexes
DROP INDEX IF EXISTS idx_customer_reviews_status;
DROP INDEX IF EXISTS idx_customer_reviews_sort;

-- Recreate indexes on new table
CREATE INDEX IF NOT EXISTS idx_case_studies_status ON case_studies(status);
CREATE INDEX IF NOT EXISTS idx_case_studies_sort ON case_studies(sort_order);
