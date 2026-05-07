---
name: cloudflare-mcp-deploy
description: Deploy this Dream project to Cloudflare Workers using the official Cloudflare API MCP plus Wrangler/OpenNext build artifacts. Use when the user asks to deploy, publish, push online, verify the live Worker, inspect Workers versions/deployments, or recover from Wrangler deploy/upload hanging after asset upload.
---

# Cloudflare MCP Deploy

Deploy the current Dream app to Cloudflare Workers with a workflow that keeps the Worker code and static assets in sync, and still gives you a fallback when `wrangler deploy` hangs.

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

## Normal path for real releases

Use the full OpenNext plus Wrangler deploy path first. This is the default for production releases because it uploads both:

- the Worker bundle
- the `.open-next/assets` static files behind the `ASSETS` binding

Run:

```bash
pnpm exec opennextjs-cloudflare build
pnpm d1:test -- --db dream --remote
pnpm exec wrangler deploy
```

If Cloudflare shows a new version and deployment, stop there.

Do not replace this with a Worker-only upload during a normal release. In this repo, a Worker-only upload can leave production in a broken state where:

- HTML references new `/_next/static/...` hashes
- the corresponding CSS or JS files were not uploaded
- the page returns `200` but renders blank because the client bundle cannot boot

If `wrangler deploy` asks for confirmation during asset upload, accept it and let it finish.

## Failure mode to recognize

Wrangler/OpenNext may do this:

- build succeeds
- assets upload succeeds
- remote upload hangs for minutes
- Cloudflare still shows no new Worker version

Do not keep retrying blind. Check the versions list. If no new version appears, switch to the fallback path below.

## Fallback path for debugging or last-resort recovery

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

This direct upload path preserves the existing Worker name, D1 binding, and plain-text vars already stored in Cloudflare.

Important: this path does not reliably refresh `ASSETS`. Treat it as a debugging or emergency path only. After using it, you must still verify that the required static files exist on production. If production HTML references new hashes that return `404`, immediately run the full `wrangler deploy` path above to sync assets.

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

4. Confirm static assets are actually present:

- open the live page in a browser and inspect console plus network
- verify critical `/_next/static/...` CSS and JS files return `200`
- if the page is blank but HTML is `200`, look for missing assets before changing application code

High-signal production failure pattern in this repo:

- page returns `200`
- HTML contains `BAILOUT_TO_CLIENT_SIDE_RENDERING`
- browser console shows `404` for `/_next/static/css/...` or `/_next/static/chunks/...`

That usually means the Worker was updated without a matching static asset upload.

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
- `pnpm build` alone is not enough for Cloudflare release packaging in this repo. It creates `.next`, but not the final `.open-next/worker.js` release artifact.
- If production is blank after a deploy, check missing hashed CSS and JS assets before patching React code.
- Current Worker settings expose `AUTH_SECRET` as plain text in bindings. Flag this as a security cleanup item. Prefer a real secret binding.

## Recommended response format

When reporting back:

1. say whether deploy succeeded
2. give the live URL
3. give the new version ID and deployment time
4. mention whether D1 was verified
5. call out any security or config concerns
