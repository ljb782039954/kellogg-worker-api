# Kellogg API

基于 Cloudflare Workers 的 Serverless 后端 API 服务，为 Kellogg 电商系统提供高性能的边缘数据接口。

## 架构说明

- **计算层 (Workers)**: 负责路由分发、请求鉴权、业务逻辑处理以及图片云端优化重定向 (`/cdn-cgi/image/`)。
- **结构化数据 (D1 SQLite)**: 存储具有强关系特征的数据模型（如：产品库、分类目录、客户询盘）。
- **灵活配置层 (KV)**: 存储动态积木页面（分离式架构：`pages_index` 索引 + `page:[id]` 详情）以及全局站点配置（导航、页脚、公司信息）。
- **对象存储 (R2)**: 统一保存管理端上传的媒体资产，通过专属资源域名对外提供服务。

## 目录结构

```text
worker-api/
├── migrations/              # D1 数据库 SQL 迁移文件
├── src/
│   ├── index.ts            # Worker 核心入口与定时任务 (Cron) 拦截
│   ├── routes/             # API 模块化路由
│   │   ├── routes.ts       # 路由策略分发器
│   │   ├── products.ts     # 商品管理接口
│   │   ├── categories.ts   # 分类管理接口
│   │   ├── config.ts       # KV 动态配置与页面构建器接口
│   │   ├── upload.ts       # R2 图片上传与展示接口
│   │   ├── inquiries.ts    # 客户询盘表单接口
│   │   └── system.ts       # 系统初始化辅助接口
│   ├── tasks/              # 异步任务脚本
│   │   ├── gc.ts           # R2 孤儿图片清理 (支持手动触发)
│   │   └── exchangeRates.ts# 全球汇率自动同步
│   ├── utils/              # 响应封装与 Token 鉴权中间件
│   └── types/              # 全局 TypeScript 接口定义
└── wrangler.toml           # Cloudflare 环境与资源绑定配置
```

## 开发与部署

- **本地开发**: `npm run dev` (启动 Wrangler 本地模拟环境，默认端口 `8787`)
- **生产发布**: `npm run deploy` (编译部署至 Cloudflare 全球边缘节点)

> **环境依赖**: 确保在 Cloudflare 仪表盘或通过 Wrangler CLI 正确配置了 `DB`, `ASSETS`, `KELLOGG_FRONTEND_CONFIG` 绑定，以及必要的敏感环境变量（如 `ADMIN_TOKEN`）。
