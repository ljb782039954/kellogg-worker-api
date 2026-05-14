
import type { Translation } from "./common";

// ============================================
// 积木块系统 (Block-based System)
// ============================================

export type BlockType =
  | 'carousel'
  | 'categories'
  | 'newArrivals'
  | 'featuredProducts'
  | 'productGrid'
  | 'brandValues'
  | 'statistics'
  | 'testimonials'
  | 'faq'
  | 'textSection'
  | 'imageBanner'
  | 'imageBannerTag'
  | 'videoSection'
  | 'imageText'
  | 'ctaBanner'
  | 'countdown'
  | 'partnerLogos'
  | 'gallery'
  | 'featureList';

// 组件分类
export type ComponentCategory = 'product' | 'marketing' | 'content' | 'media';

// 组件元数据
export interface ComponentMeta {
  type: BlockType;
  name: Translation;
  description: Translation;
  icon: string;  // lucide 图标名称
  category: ComponentCategory;
  hasGlobalData: boolean;  // 是否使用全局数据（如商品列表、评价列表等）
  singleton?: boolean;     // 是否只能添加一个
  defaultProps: any;
}

export interface PageBlock {
  id: string;          // 唯一ID，用于拖拽排序
  type: BlockType;     // 组件类型
  content: any;        // 该组件的具体属性 (统一使用 content)
  isVisible: boolean;   // 是否可见 (统一使用 isVisible)
}

export interface CustomPage {
  id: string;          // 页面标识ID (如 'home')
  path: string;        // 路由地址 (如 '/', '/products')
  title: Translation;  // 页面名称/标题
  isFixed: boolean;    // 是否为固定系统页面 (不可删除)
  blocks: PageBlock[]; // 存放积木块数组
  seo?: {
    title: Translation;
    description: Translation;
  };
}

