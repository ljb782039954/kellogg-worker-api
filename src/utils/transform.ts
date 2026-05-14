// 数据转换工具函数
import {
  ProductRow,
  ProductImageRow,
  Product,
  CategoryRow,
  Category,
  ProductSizeRow,
  ProductColorRow,
  ProductCustomFieldRow,
  ProductVideoRow
} from '../types';

// 构建完整的图片 URL
export function buildImageUrl(baseUrl: string, imageKey: string | null): string {
  if (!imageKey) return '';
  if (imageKey.startsWith('http')) return imageKey;
  return `${baseUrl}/${imageKey}`;
}

// 转换商品数据
export function transformProduct(
  row: ProductRow,
  images: ProductImageRow[],
  sizes: ProductSizeRow[],
  colors: ProductColorRow[],
  customFields: ProductCustomFieldRow[],
  videos: ProductVideoRow[],
  baseUrl: string
): Product {
  // 注意: images 数组过滤当前产品的图片
  const productImages = images
    .filter(img => img.product_id === row.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(img => buildImageUrl(baseUrl, img.image_key));

  return {
    id: row.id,
    name: { zh: row.name_zh, en: row.name_en },
    price: row.price,
    originalPrice: row.original_price ?? undefined,
    bulkPrices: row.bulk_prices ? JSON.parse(row.bulk_prices) : [],
    image: buildImageUrl(baseUrl, row.image),
    images: productImages,
    rating: row.rating,
    sales: row.sales,
    tag: row.tag_zh || row.tag_en
      ? { zh: row.tag_zh || '', en: row.tag_en || '' }
      : undefined,
    category: row.category_id ?? undefined,
    releaseDate: row.release_date ?? undefined,
    description: row.description_zh || row.description_en
      ? { zh: row.description_zh || '', en: row.description_en || '' }
      : undefined,
    isFeatured: row.is_featured === 1,
    isActive: row.is_active === 1,
    fabric: row.fabric_zh || row.fabric_en
      ? { zh: row.fabric_zh || '', en: row.fabric_en || '' }
      : undefined,
    notes: row.notes_zh || row.notes_en
      ? { zh: row.notes_zh || '', en: row.notes_en || '' }
      : undefined,
    sizes: sizes
      .filter(s => s.product_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({
        name: s.name,
        image: buildImageUrl(baseUrl, s.image)
      })),
    colors: colors
      .filter(c => c.product_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({
        name: { zh: c.name_zh, en: c.name_en },
        image: buildImageUrl(baseUrl, c.image)
      })),
    customFields: customFields
      .filter(cf => cf.product_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(cf => ({
        name: { zh: cf.name_zh, en: cf.name_en },
        value: { zh: cf.value_zh, en: cf.value_en }
      })),
    videos: videos
      .filter(v => v.product_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(v => v.video_url),
  };
}

// 转换分类数据
export function transformCategory(row: CategoryRow, baseUrl?: string): Category {
  return {
    id: row.id,
    name: { zh: row.name_zh, en: row.name_en },
    image: baseUrl && row.image ? buildImageUrl(baseUrl, row.image) : (row.image || undefined),
  };
}
