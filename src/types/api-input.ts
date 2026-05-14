// Worker 环境绑定类型
export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  KELLOGG_FRONTEND_CONFIG: KVNamespace; // 统一绑定名称为 KELLOGG_FRONTEND_CONFIG
  ASSETS_BASE_URL: string;
  CORS_ORIGIN: string;
  ADMIN_TOKEN?: string;
  EXCHANGE_RATE_API_KEY?: string;
}


// ============================================
// 数据库行类型 (D1 关系型数据)
// ============================================

export interface CategoryRow {
  id: string;
  name_zh: string;
  name_en: string;
  image?: string;
  sort_order?: number;
}

export interface ProductRow {
  id: number;
  name_zh: string;
  name_en: string;
  price: number;
  original_price: number | null;
  bulk_prices: string | null;
  image: string | null;
  category_id: string | null;
  rating: number;
  sales: number;
  tag_zh: string | null;
  tag_en: string | null;
  description_zh: string | null;
  description_en: string | null;
  release_date: string | null;
  sort_order: number;
  is_featured: number;
  fabric_zh: string | null;
  fabric_en: string | null;
  notes_zh: string | null;
  notes_en: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductSizeRow {
  id: number;
  product_id: number;
  name: string;
  image: string | null;
  sort_order: number;
}

export interface ProductColorRow {
  id: number;
  product_id: number;
  name_zh: string;
  name_en: string;
  image: string | null;
  sort_order: number;
}

export interface ProductImageRow {
  id: number;
  product_id: number;
  image_key: string;
  sort_order: number;
}

export interface ProductVideoRow {
  id: number;
  product_id: number;
  video_url: string;
  sort_order: number;
}

export interface ProductCustomFieldRow {
  id: number;
  product_id: number;
  name_zh: string;
  name_en: string;
  value_zh: string;
  value_en: string;
  sort_order: number;
}

export interface InquiryRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  company: string | null;
  product_type: string | null;
  quantity: string | null;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// API 输入类型
export interface CreateProductInput {
  name_zh: string;
  name_en: string;
  price: number;
  original_price?: number;
  bulk_prices?: { minQty: number; maxQty: number | null; price: number }[];
  image?: string;
  category_id?: string;
  rating?: number;
  sales?: number;
  tag_zh?: string;
  tag_en?: string;
  description_zh?: string;
  description_en?: string;
  release_date?: string;
  is_featured?: boolean;
  images?: string[];
  videos?: string[];
  fabric_zh?: string;
  fabric_en?: string;
  notes_zh?: string;
  notes_en?: string;
  sizes?: { name: string; image?: string }[];
  colors?: { name_zh: string; name_en: string; image?: string }[];
  custom_fields?: { name_zh: string; name_en: string; value_zh: string; value_en: string }[];
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export interface CreateInquiryInput {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  company?: string;
  product_type?: string;
  quantity?: string;
  message?: string;
}
