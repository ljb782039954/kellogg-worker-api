// Worker 环境绑定类型
export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  KELLOGG_FRONTEND_CONFIG: KVNamespace; // 统一绑定名称为 KELLOGG_FRONTEND_CONFIG
  ASSETS_BASE_URL: string;
  CORS_ORIGIN: string;
  ADMIN_TOKEN?: string;
  EXCHANGE_RATE_API_KEY?: string;
  DEPLOY_HOOK_URL?: string;
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

// ============================================
// Blog types
// ============================================

export interface BlogRow {
  id: number;
  slug: string;
  title_zh: string;
  title_en: string;
  summary_zh: string | null;
  summary_en: string | null;
  content_zh: string;
  content_en: string;
  cover_image: string | null;
  category: string | null;
  tags: string;            // JSON string array e.g. '["Cotton","OEM"]'
  author: string;
  status: string;          // 'draft' | 'published' | 'archived'
  seo_title_zh: string | null;
  seo_title_en: string | null;
  seo_desc_zh: string | null;
  seo_desc_en: string | null;
  publish_date: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBlogInput {
  slug: string;
  title_zh: string;
  title_en: string;
  summary_zh?: string;
  summary_en?: string;
  content_zh?: string;
  content_en?: string;
  cover_image?: string;
  category?: string;
  tags?: string[];
  author?: string;
  status?: 'draft' | 'published' | 'archived';
  seo_title_zh?: string;
  seo_title_en?: string;
  seo_desc_zh?: string;
  seo_desc_en?: string;
  publish_date?: string;
}

export interface UpdateBlogInput extends Partial<CreateBlogInput> {}

// ============================================
// Blog Category Types
// ============================================

export interface BlogCategoryRow {
  id: number;
  name_zh: string;
  name_en: string;
  slug: string;
  sort_order: number;
  created_at: string;
  article_count?: number;
}

export interface CreateBlogCategoryInput {
  name_zh: string;
  name_en: string;
  slug?: string;
  sort_order?: number;
}

export interface UpdateBlogCategoryInput {
  name_zh?: string;
  name_en?: string;
  slug?: string;
  sort_order?: number;
}

// ============================================
// Customer Review Types
// ============================================

export interface CustomerReviewRow {
  id: number;
  client_name: string;
  country: string | null;
  rating: number;
  media_type: 'video' | 'image';
  media_url: string;
  review_text_zh: string;
  review_text_en: string;
  sort_order: number;
  status: 'published' | 'draft';
  created_at: string;
  updated_at: string;
}

export interface CreateReviewInput {
  client_name: string;
  country?: string;
  rating?: number;
  media_type: 'video' | 'image';
  media_url: string;
  review_text_zh: string;
  review_text_en: string;
  sort_order?: number;
  status?: 'published' | 'draft';
}


