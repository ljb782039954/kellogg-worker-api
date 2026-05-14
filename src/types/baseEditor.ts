import type { Translation, LinkType, NavLink } from "./common";

// ============================================
// UI 与导航
// ============================================



export interface SocialMediaType {
  wechat?: string;
  weibo?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
  whatsapp?: string;
}

// 公司信息
export interface CompanyInfo {
  name: Translation;
  logo: string;
  description: Translation;
  contact: {
    phone: string;
    email: string;
    address: Translation;
  };
  socialMedia: SocialMediaType;
}

// Header content
export interface HeaderContent {
  logoText: Translation;
  navItems: NavLink[];
}

// Footer
export interface FooterLink {
  id: string;
  name: Translation;
  linkType: LinkType;
  href: string;
  pageDeleted?: boolean;
}

export interface FooterLinkGroup {
  id: string;
  title: Translation;
  links: FooterLink[];
}

export interface FooterContent {
  linkGroups: FooterLinkGroup[];
  newsletterPlaceholder: Translation;
  newsletterButton: Translation;
}

export interface FooterGroupInput {
  title_zh: string;
  title_en: string;
  sort_order?: number;
  links?: Array<{
    name_zh: string;
    name_en: string;
    href: string;
    sort_order?: number;
  }>;
}
