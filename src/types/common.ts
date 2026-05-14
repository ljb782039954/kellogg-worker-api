// Language type
export type Language = 'zh' | 'en';

// Translation interface
export interface Translation {
  zh: string;
  en: string;
}

export type LinkType = 'internal' | 'external';

export interface NavLink {
  id: string;          // 唯一ID
  name: Translation;
  linkType: LinkType;
  href: string;        // 内部链接为 pagePath (如 '/')，外部链接为完整 URL
  pageDeleted?: boolean; // 标记链接目标页面是否已被删除
}
