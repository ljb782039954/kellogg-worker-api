-- Migration: 0006_create_customer_reviews.sql
-- Customer reviews and case studies table
CREATE TABLE IF NOT EXISTS customer_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name TEXT NOT NULL,
  country TEXT,
  rating REAL DEFAULT 5.0,
  media_type TEXT DEFAULT 'video',
  media_url TEXT NOT NULL,
  review_text_zh TEXT NOT NULL,
  review_text_en TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for status filtering (public endpoint only returns 'published')
CREATE INDEX IF NOT EXISTS idx_customer_reviews_status ON customer_reviews(status);

-- Index for sort_order (results are ordered DESC by sort_order)
CREATE INDEX IF NOT EXISTS idx_customer_reviews_sort ON customer_reviews(sort_order);
