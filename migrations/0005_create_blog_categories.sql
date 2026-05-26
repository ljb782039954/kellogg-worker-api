-- Create blog categories table
CREATE TABLE IF NOT EXISTS blog_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories(slug);

-- Seed default categories (matching existing hardcoded list)
INSERT OR IGNORE INTO blog_categories (name_zh, name_en, slug, sort_order) VALUES
  ('行业资讯', 'Industry News', 'industry-news', 1),
  ('面料指南', 'Fabric Guide', 'fabric-guide', 2),
  ('OEM 技巧', 'OEM Tips', 'oem-tips', 3),
  ('趋势报告', 'Trend Report', 'trend-report', 4),
  ('公司动态', 'Company News', 'company-news', 5);
