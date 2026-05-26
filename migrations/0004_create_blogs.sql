-- Create blogs table for Kellogg blog module
CREATE TABLE IF NOT EXISTS blogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  summary_zh TEXT,
  summary_en TEXT,
  content_zh TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  category TEXT,
  tags TEXT DEFAULT '[]',
  author TEXT DEFAULT 'Admin',
  status TEXT DEFAULT 'draft',
  seo_title_zh TEXT,
  seo_title_en TEXT,
  seo_desc_zh TEXT,
  seo_desc_en TEXT,
  publish_date TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_status ON blogs(status);
CREATE INDEX IF NOT EXISTS idx_blogs_category ON blogs(category);
CREATE INDEX IF NOT EXISTS idx_blogs_publish_date ON blogs(publish_date);
