-- Migration: 0001_init.sql
-- 初始化数据库结构，同步 adminApp 数据结构定义
-- D1 数据库仅保留真正的关系型数据（分类、产品）
-- 页面、轮播图等组件配置数据已全部迁移至 Cloudflare KV (积木架构)

-- ============================================
-- 1. 产品分类表 (Categories)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  image TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- 2. 产品表 (Products)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price INTEGER NOT NULL,
  original_price INTEGER,
  image TEXT,
  category_id TEXT,
  rating REAL DEFAULT 5.0,
  sales INTEGER DEFAULT 0,
  tag_zh TEXT,
  tag_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  release_date TEXT,
  is_featured INTEGER DEFAULT 0,  -- 0=false, 1=true
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);

-- ============================================
-- 3. 产品图片表 (Product Gallery)
-- 存储产品的多张图片
-- ============================================
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_key TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- 预置数据: 分类
-- ============================================
INSERT INTO categories (id, name_zh, name_en, image) VALUES
('tops', '上装', 'Tops', 'images/photo-1523381210434-271e8be1f52b?w=400&h=400&fit=crop'),
('bottoms', '下装', 'Bottoms', 'images/photo-1594932224456-75a7724a10f8?w=400&h=400&fit=crop'),
('casual', '休闲装', 'Casual Wear', 'images/photo-1523381210434-271e8be1f52b?w=400&h=400&fit=crop'),
('formal', '正装', 'Formal Wear', 'images/photo-1594932224456-75a7724a10f8?w=400&h=400&fit=crop'),
('dresses', '连衣裙', 'Dresses', 'images/photo-1539008835279-43469efad90f?w=400&h=400&fit=crop'),
('sportswear', '运动装', 'Sportswear', 'images/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop'),
('underwear', '内衣', 'Underwear', 'images/photo-1621335829175-95f437384d7c?w=400&h=400&fit=crop'),
('outerwear', '外衣', 'Outerwear', 'images/photo-1591047139829-d91aecb6caea?w=400&h=400&fit=crop');

-- ============================================
-- 预置数据: 产品 (Products)
-- ============================================
INSERT INTO products (id, name_zh, name_en, price, original_price, image, category_id, rating, sales, tag_zh, tag_en, release_date, is_featured, sort_order) VALUES
(1, '简约米色羊毛针织衫', 'Minimalist Beige Wool Sweater', 599, 799, '/images/products/product1.jpg', 'tops', 4.8, 1200, '热销', 'Hot', '2024-01-15', 1, 0),
(2, '经典黑色阔腿裤', 'Classic Black Wide-leg Pants', 459, NULL, '/images/products/product2.jpg', 'bottoms', 4.6, 890, NULL, NULL, '2024-02-01', 0, 1),
(3, '灰色羊毛混纺毛衣', 'Gray Wool Blend Sweater', 699, 899, '/images/products/product3.jpg', 'tops', 4.9, 1500, '新品', 'New', '2024-03-01', 0, 2),
(4, '黑色雪纺衫', 'Black Chiffon Shirt', 299, NULL, '/images/products/product4.jpg', 'tops', 4.7, 650, NULL, NULL, '2024-01-20', 0, 3),
(5, '白色纯棉T恤', 'White Cotton T-Shirt', 199, NULL, '/images/products/product2.jpg', 'tops', 4.5, 2300, NULL, NULL, '2024-02-15', 0, 4),
(6, '深蓝色牛仔裤', 'Dark Blue Jeans', 399, 499, '/images/products/product3.jpg', 'bottoms', 4.7, 1500, '热销', 'Hot', '2024-01-10', 0, 5),
(7, '黑色连衣裙', 'Black Dress', 799, NULL, '/images/products/product1.jpg', 'dresses', 4.8, 800, NULL, NULL, '2024-03-05', 0, 6),
(8, '米色风衣', 'Beige Trench Coat', 1299, 1599, '/images/hero/hero1.jpg', 'tops', 4.9, 450, '新品', 'New', '2024-03-10', 0, 7);
