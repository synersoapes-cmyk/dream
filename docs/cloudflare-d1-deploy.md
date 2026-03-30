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

- `database_name` 可以保留为 `dream` 或改成你的正式库名
- `database_id` 需要替换成 Cloudflare D1 实际库 ID
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

如果后续你把 schema 真正写进项目，可以这样执行：

本地应用迁移：

```bash
pnpm d1:migrate:local
```

远程应用迁移：

```bash
pnpm d1:migrate:remote
```

如果只是先部署现有项目而还没有新增迁移文件，当前 `migrations_d1` 目录会是空目录，这是正常的。

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

因此：

- Cloudflare 线上环境使用 D1
- 非 Cloudflare 运行时不会获得 D1 binding

这意味着如果你在纯 Node 本地环境直接把 `DATABASE_PROVIDER=d1` 跑起来，数据库相关逻辑不会像本地 sqlite 那样完整可用。

## 7. 推荐后续动作

为了让这个项目真正完整跑在 D1 上，下一步最推荐继续做两件事：

1. 把业务 schema 正式写进 [src/config/db/schema.sqlite.ts](D:/project/dream/src/config/db/schema.sqlite.ts)
2. 生成第一批 D1 migration 并执行远程部署
