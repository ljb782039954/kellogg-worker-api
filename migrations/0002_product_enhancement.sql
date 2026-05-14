-- Migration: 0002_product_enhancement.sql
-- 增强商品数据结构：尺码、颜色、面料说明、注意事项

-- 1. 向 products 表添加字段
ALTER TABLE products ADD COLUMN fabric_zh TEXT;
ALTER TABLE products ADD COLUMN fabric_en TEXT;
ALTER TABLE products ADD COLUMN notes_zh TEXT;
ALTER TABLE products ADD COLUMN notes_en TEXT;

-- 2. 创建商品尺码表 (Product Sizes)
CREATE TABLE IF NOT EXISTS product_sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,         -- 尺码名称 (S, M, L, XL 等)
  image TEXT,                 -- 尺码对应图片 (可选)
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 3. 创建商品颜色表 (Product Colors)
CREATE TABLE IF NOT EXISTS product_colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  name_zh TEXT NOT NULL,      -- 颜色中文名
  name_en TEXT NOT NULL,      -- 颜色英文名
  image TEXT,                 -- 颜色对应图片 (可选)
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_sizes_product ON product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_product ON product_colors(product_id);
