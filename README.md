# Kellogg API - Cloudflare Worker

基于 Cloudflare Workers 的后端 API 服务，为 Kellogg 电商网站提供数据接口。

## 项目概览

请阅读 `docs/README.md`

## 本地开发命令

```bash
# 安装依赖
npm install

# 本地开发（需要先创建资源）
npm run dev

# 本地数据库迁移（本地测试，首次/修改表结构后运行）
# 本地开发时会自动创建 `.wrangler` 目录存放本地数据库和 KV 数据。
# 也可以通过该命令，更新数据库结构
npm run db:migrate:local

# 删除本地状态（PowerShell），如果本地有状态的话。
Remove-Item -Path .wrangler -Recurse -Force

# 查看日志
npm run tail
```

## 正式部署

```bash
# 登录
npx wrangler login

# 1. 同步数据库，如果数据库变更了，也是运行这个命令
npm run db:migrate
# 2. 设置密钥
npx wrangler secret put ADMIN_TOKEN
# 3. 部署 Cloudflare， 如果更新数据库，这也是需要执行的
npm run deploy

```

### 初始化 KV 数据 (页面配置、积木数据)

```bash
# 本地初始化 (需先运行 npm run dev，然后在新窗口运行)
npm run db:seed:kv:local

# 线上初始化 (需先将域名和 Token 填入 package.json 或修改脚本)
# 修改 package.json中的域名和token (就是设置ADMIN_TOKEN的secret value)
npm run db:seed:kv:remote

# 生产环境，初始化KV数据
curl.exe -X POST "https://{Base_URL}/api/system/init-kv" -H "Authorization: Bearer {ADMIN_TOKEN}"
```

> **提示**：如果想在本地直接操作线上 KV，可以运行 `npx wrangler dev --remote` 后执行 `npm run db:seed:kv:local`。

### 验证步骤（本地开发）

1. 访问 http://localhost:8787/api/health - 应返回 {"status":"ok"}
2. 访问 http://localhost:8787/api/categories - 应返回分类列表
3. 启动 adminApp，（访问 http://localhost:3000） - 应能连接到 API

---

## 首次部署步骤

### 1. 创建 Cloudflare 资源

这些也可以在官网上操作

```bash
# 登录 Cloudflare
wrangler login

# 创建 D1 数据库
wrangler d1 create kellogg-db

# 创建 R2 存储桶
wrangler r2 bucket create kellogg-assets

# 创建 KV 命名空间
wrangler kv namespace create KELLOGG_FRONTEND_CONFIG
```

### 2. 更新 wrangler.toml

将创建命令返回的 ID 填入 `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "kellogg-db"
database_id = "your-database-id-here"

[[kv_namespaces]]
binding = "KELLOGG_FRONTEND_CONFIG"
id = "your-kv-namespace-id-here"
```

### 3. 配置 R2 公共访问

在 Cloudflare Dashboard 中为 R2 存储桶配置公共访问域名，并更新 `wrangler.toml` 中的 `ASSETS_BASE_URL`。
