import type { Translation } from "./common";

// ============================================
// 商品与分类 (D1 关系型数据)
// ============================================

export interface Category {
  id: string;
  name: Translation;
  image?: string;
}

export interface SortOption {
  id: string;
  name: Translation;
}

export interface BulkPrice {
  minQty: number;
  maxQty: number | null;
  price: number;
}

export interface Product {
  id: number;
  name: Translation;
  price: number;
  originalPrice?: number;
  bulkPrices?: BulkPrice[];
  image: string;
  images: string[];
  videos: string[];
  rating: number;
  sales: number;
  tag?: Translation;
  category?: string;
  releaseDate?: string;
  description?: Translation;
  isFeatured: boolean;
  fabric?: Translation;
  notes?: Translation;
  isActive: boolean;
  sizes?: { name: string; image?: string }[];
  colors?: { name: Translation; image?: string }[];
  customFields?: { name: Translation; value: Translation }[];
}
