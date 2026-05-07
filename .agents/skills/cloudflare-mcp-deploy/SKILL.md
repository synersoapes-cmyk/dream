---
name: cloudflare-mcp-deploy
description: Deploy this Dream project to Cloudflare Workers using the official Cloudflare API MCP plus Wrangler/OpenNext build artifacts. Use when the user asks to deploy, publish, push online, verify the live Worker, inspect Workers versions/deployments, or recover from Wrangler deploy/upload hanging after asset upload.
---

# Cloudflare MCP Deploy

Deploy the current Dream app to Cloudflare Workers with a workflow that survives `wrangler deploy` hanging.

This skill is project-specific:

- Worker name: `dream`
- Account ID: `cff9280fb5ae0de2ac35036ccaa7d3a5`
- Live URL: `https://dream.picarowack.workers.dev`
- D1 database ID: `8dd34671-db31-43c7-82a1-19320c7ca4ba`
- Wrangler config: `wrangler.toml`

Use the official `cloudflare-api` MCP for inspection and verification. Do not expect MCP resource listing to work. The official server is tool-first, not resources-first.

## When to use this path

Use this skill when:

- `pnpm cf:deploy` or `pnpm opennextjs-cloudflare deploy` stalls after asset upload
- `wrangler versions upload` hangs and no new Worker version appears
- you need to confirm live Worker, deployments, versions, D1, or bindings through Cloudflare API MCP
- you need a repeatable fallback that does not depend on Wrangler finishing the remote upload step

## Fast checks first

1. Confirm local auth and official MCP:

```bash
codex mcp list
pnpm wrangler whoami
```

2. Confirm build artifacts exist:

```bash
test -f .open-next/worker.js && echo ok
test -f .open-next/server-functions/default/handler.mjs && echo ok
```

3. Confirm remote state before deploy with Cloudflare MCP:

- List Worker versions for `dream`
- List deployments for `dream`
- List D1 databases, then query the `dream` DB directly if needed

Good MCP checks:

- `GET /accounts/{account_id}/workers/scripts`
- `GET /accounts/{account_id}/workers/scripts/dream/versions`
- `GET /accounts/{account_id}/workers/scripts/dream/deployments`
- `GET /accounts/{account_id}/workers/scripts/dream/settings`
- `GET /accounts/{account_id}/d1/database`
- `POST /accounts/{account_id}/d1/database/{database_id}/query`

## Normal path

Run the normal build first:

```bash
pnpm build
pnpm d1:test -- --db dream --remote
pnpm cf:deploy
```

If Cloudflare shows a new version and deployment, stop there.

## Failure mode to recognize

Wrangler/OpenNext may do this:

- build succeeds
- assets upload succeeds
- remote upload hangs for minutes
- Cloudflare still shows no new Worker version

Do not keep retrying blind. Check the versions list. If no new version appears, switch to the fallback path below.

## Fallback path that worked

### Step 1: Generate the final single-file Worker bundle locally

Use Wrangler dry-run to emit the final bundled Worker:

```bash
rm -rf /tmp/dream-wrangler-dry
mkdir -p /tmp/dream-wrangler-dry
OPEN_NEXT_DEPLOY=true pnpm exec wrangler versions upload --dry-run --outdir /tmp/dream-wrangler-dry
```

Expected output files:

- `/tmp/dream-wrangler-dry/worker.js`
- `/tmp/dream-wrangler-dry/worker.js.map`

This step proves local packaging is good even when remote upload is bad.

### Step 2: Upload the final bundle directly to Cloudflare

Use direct REST upload with the existing API token:

```bash
curl -sS -o /tmp/dream-cf-upload-response.json -w "%{http_code}" \
  -X PUT "https://api.cloudflare.com/client/v4/accounts/cff9280fb5ae0de2ac35036ccaa7d3a5/workers/scripts/dream/content" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F 'metadata={"main_module":"worker.js"};type=application/json' \
  -F 'files=@/tmp/dream-wrangler-dry/worker.js;type=application/javascript+module;filename=worker.js'
```

Success looks like:

- `HTTP_CODE:200`
- `modified_on` updates on the Worker
- `deployment_id` changes
- `last_deployed_from` becomes `api`

This direct upload path preserves the existing Worker name, assets, D1 binding, and plain-text vars already stored in Cloudflare.

## Validate after deploy

1. Confirm Worker changed:

- Cloudflare MCP or REST should show:
  - new `modified_on`
  - new deployment record
  - new Worker version

2. Confirm public URL responds:

```bash
curl -I -L --max-time 30 https://dream.picarowack.workers.dev
```

Expected:

- `HTTP/2 200`
- `x-opennext: 1`

3. Confirm versions/deployments:

- latest version should increment
- newest deployment should point 100% to the new version

## D1 verification

Do not trust D1 summary metadata alone. Query the DB directly.

Useful checks:

- tables:

```sql
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
```

- migration count:

```sql
SELECT COUNT(*) AS migration_count, MIN(name) AS first_migration, MAX(name) AS last_migration FROM d1_migrations;
```

Remote `num_tables` metadata may be misleading even when the database is healthy.

## Known gotchas

- `cloudflare-api` MCP may reject `resources/list` with `Method not found`. That is normal.
- `pnpm opennextjs-cloudflare deploy` and `pnpm opennextjs-cloudflare upload` can hang after asset upload.
- A hanging `wrangler versions upload` does not mean a new version exists. Check the versions API.
- Large direct uploads can take several minutes and show heavy TCP retransmits before succeeding.
- Current Worker settings expose `AUTH_SECRET` as plain text in bindings. Flag this as a security cleanup item. Prefer a real secret binding.

## Recommended response format

When reporting back:

1. say whether deploy succeeded
2. give the live URL
3. give the new version ID and deployment time
4. mention whether D1 was verified
5. call out any security or config concerns

