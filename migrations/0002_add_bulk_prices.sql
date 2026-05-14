-- 增加批量价格字段到 products 表
ALTER TABLE products ADD COLUMN bulk_prices TEXT DEFAULT '[]';
