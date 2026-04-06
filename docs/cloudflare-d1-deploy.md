# Cloudflare D1 部署说明

## 1. 当前项目调整内容

本项目已经调整为优先面向 Cloudflare D1 部署：

- 运行时数据库绑定改为读取 Cloudflare Worker 的 `DB`
- 新增正式的 [wrangler.toml](D:/project/dream/wrangler.toml)
- `.env.example` 默认数据库改为 `d1`
- 新增 D1 迁移目录 `src/config/db/migrations_d1`
- 新增迁移脚本：
  - `pnpm d1:migrate:local`
  - `pnpm d1:migrate:remote`

## 2. 部署前需要修改的配置

编辑 [wrangler.toml](D:/project/dream/wrangler.toml)：

- `name`
- `database_id`
- `NEXT_PUBLIC_APP_URL`
- `AUTH_SECRET`

其中：

- `database_name` 可以保留为 `dream`，或改成你的正式库名
- `database_id` 需要替换成 Cloudflare D1 实际数据库 ID
- `AUTH_SECRET` 需要替换成真实随机值

## 3. 创建 D1 数据库

先在 Cloudflare 中创建数据库：

```bash
wrangler d1 create dream
```

创建成功后，Cloudflare 会返回：

- `database_name`
- `database_id`

把返回的 `database_id` 填入 [wrangler.toml](D:/project/dream/wrangler.toml)。

## 4. 生成与应用迁移

如果后续你把 schema 正式写进项目，可以这样执行：

本地应用迁移：

```bash
pnpm d1:migrate:local
```

远程应用迁移：

```bash
pnpm d1:migrate:remote
```

如果当前 `migrations_d1` 目录还是空的，这是正常情况。

## 5. 构建与部署

当前项目已经内置 Cloudflare 构建脚本：

```bash
pnpm cf:deploy
```

如果只想先测试构建：

```bash
pnpm cf:preview
```

## 6. 运行时说明

项目中的 D1 连接逻辑已经改为：

- 只在 Cloudflare Workers 运行时使用 `DB` binding
- 不再依赖 `DATABASE_URL`
- 不再提供本地 SQLite fallback

因此：

- Cloudflare 线上环境使用 D1
- 非 Cloudflare 运行时如果拿不到 `DB` binding，会直接报错

这意味着如果你在本地以 `DATABASE_PROVIDER=d1` 运行，就必须确保 Wrangler / Cloudflare context 和 `DB` binding 已经可用。

## 7. 推荐后续动作

为了让项目完整跑在 D1 上，下一步最推荐继续做两件事：

1. 把业务 schema 正式写进 [src/config/db/schema.sqlite.ts](D:/project/dream/src/config/db/schema.sqlite.ts)
2. 生成第一批 D1 migration 并执行远程部署

## 8. 模拟器 OCR 所需配置

如果要启用模拟器的“图片上传 -> R2 -> Gemini 识别”链路，除了 D1 之外还需要补齐以下配置：

- `GEMINI_API_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY`
- `R2_SECRET_KEY`
- `R2_BUCKET_NAME`

可选配置：

- `R2_ENDPOINT`
- `R2_DOMAIN`
- `R2_UPLOAD_PATH`

当前项目会优先从运行时环境变量或 Cloudflare Worker secrets 读取这些键；如果未配置，模拟器 OCR 接口会直接返回缺失项列表。
