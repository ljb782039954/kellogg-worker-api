# worker-api — 后端 API

Cloudflare Workers + D1 (SQLite) + KV + R2。零运行时依赖。

## 询盘安全配置

- 公开询盘接口在写入 D1 前强制校验 Cloudflare Turnstile。
- 生产环境通过 `wrangler secret put TURNSTILE_SECRET_KEY` 配置密钥，禁止写入仓库。
- `TURNSTILE_ALLOWED_HOSTNAMES` 配置允许的生产域名。
- 部署询盘防护前必须执行 `0010_inquiry_abuse_protection.sql` 迁移。
- 同一 IP 十分钟最多提交五次；相同邮箱和内容五分钟内拒绝重复写入。
- 本地开发需在 `.dev.vars` 中使用 Cloudflare 官方测试 secret，生产 secret 只能通过 Wrangler Secret 配置。

---

## src/ 目录导航

```
index.ts           Worker 入口（路由分发 + Cron 定时任务）
routes/            10个路由模块
├── index.ts       ~40条路由注册表（method + 正则 → handler）
├── products.ts    商品 CRUD（含6个子表关联查询）
├── categories.ts  分类 CRUD（"all" 受保护）
├── config.ts      KV 配置读写（含页面分片存储逻辑）
├── upload.ts      R2 上传/代理（支持 Range 视频流）
├── inquiries.ts   询盘 CRUD（公开提交 + 管理员管理）
├── blogs.ts       博客 CRUD（slug 校验 / 自动 view_count）
├── blogCategories.ts  博客分类 CRUD（级联更新博客）
├── reviews.ts     客户评价 CRUD（公开仅 published）
└── system.ts      系统功能（initKV / triggerBuild / syncMediaReferences）
tasks/
├── exchangeRates.ts   Cron 汇率同步（ExchangeRate-API → KV）
└── gc.ts              垃圾回收（已禁用）
types/              类型定义
├── api-input.ts    核心文件：Env / 全部 DB Row / Create*Input
└── ...其他
utils/
├── auth.ts         Bearer Token 认证
├── response.ts     CORS / JSON / 分页 / 错误响应 + URL 重写
├── transform.ts    Row → API 对象（_zh/_en 合并为 Translation）
└── media.ts        媒体引用追踪
kvData/             KV 预设数据（init-kv 的种子数据）
migrations/         D1 迁移（9个文件，共 11 个表）
```

---

## 架构要点

### 三层存储职责划分
- **D1**：核心业务实体（商品、分类、博客、询盘、评价、媒体引用关系）
- **KV**：站点配置（页面Schema、公司信息、导航、页脚、汇率、构建状态）
- **R2**：媒体文件（图片/视频，通过 `ASSETS_BASE_URL` CDN 服务）

### 页面读取策略（三层降级）
`getPageById()` 优先查 `page:{id}`（分片详情），降级到 `pages_index` 中查找，再降级到旧版 `pages` 数组兼容。`getPages()` 优先读轻量 `pages_index` 而非完整数据。

### 媒体引用追踪
每次写操作（商品/分类/博客/KV页面/评价）后调用 `updateMediaReferences()`，它先 `DELETE` 旧记录再批量 `INSERT` 新记录到 `media_references` 表。`extractMediaKeys()` 递归提取对象中所有 `uploads/` 路径的 key。

### 认证模式
非 Express 中间件模式，而是各 handler 函数内部手动调用 `requireAuth()`。如果环境未配置 `ADMIN_TOKEN` 则跳过验证（开发模式），生产环境需要 Bearer Token。

### 开发环境 URL 重写
`transformMediaUrls()` 检测请求是否来自 localhost，如是则将响应数据中的 `https://assets.kelloggfashion.com` 替换为本地 Worker 地址，避免图片 404。

### 认证感知的商品查询
`getProducts()` 根据请求是否携带有效 `Authorization` 决定是否显示 `is_active=0` 的商品。未认证用户只能看到上架商品。

### Cron 定时任务
`wrangler.toml` 中声明 `triggers`，`index.ts` 的 `scheduled()` 入口根据 cron 表达式匹配执行对应任务。汇率同步每日 0 点执行，GC 每周日执行（已禁用）。
