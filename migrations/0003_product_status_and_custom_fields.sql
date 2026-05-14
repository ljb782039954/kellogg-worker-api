-- Migration: 0003_product_status_and_custom_fields.sql
-- 增加商品上架状态和动态自定义字段

-- 1. 向 products 表添加 is_active 字段
ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;

-- 2. 创建商品自定义字段表 (Product Custom Fields)
CREATE TABLE IF NOT EXISTS product_custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  name_zh TEXT NOT NULL,      -- 参数中文名 (如: 发货地)
  name_en TEXT NOT NULL,      -- 参数英文名 (如: Shipping From)
  value_zh TEXT NOT NULL,     -- 参数中文值 (如: 中国)
  value_en TEXT NOT NULL,     -- 参数英文值 (如: China)
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_custom_fields_product ON product_custom_fields(product_id);
