# AGENTS.md

## Project

- Name: `dream`
- Stack: `Next.js 16`, `React 19`, `TypeScript`, `Drizzle ORM`
- Deployment target: `Cloudflare Workers`
- Database target: `Cloudflare D1`

## Database

- Runtime D1 binding name: `DB`
- Wrangler config: [wrangler.toml](D:/project/dream/wrangler.toml)
- SQLite schema file: [src/config/db/schema.sqlite.ts](D:/project/dream/src/config/db/schema.sqlite.ts)
- D1 migration directory: [src/config/db/migrations_d1](D:/project/dream/src/config/db/migrations_d1)

## Key Commands

- Install deps: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Cloudflare preview: `pnpm cf:preview`
- Cloudflare deploy: `pnpm cf:deploy`
- D1 local migrate: `pnpm d1:migrate:local`
- D1 remote migrate: `pnpm d1:migrate:remote`
- D1 smoke test: `pnpm d1:test -- --db test --local`

## Notes

- This project now prefers `D1` over `DATABASE_URL`-based providers.
- In local `wrangler` mode, D1 execution resolves through the configured binding or database name in `wrangler.toml`.
- The smoke test script is [scripts/test-d1.ts](D:/project/dream/scripts/test-d1.ts).
- Deployment notes are in [docs/cloudflare-d1-deploy.md](D:/project/dream/docs/cloudflare-d1-deploy.md).
- Main project documentation lives in Lark: [梦幻核心说明0326](https://csgy1xzrndus.sg.larksuite.com/wiki/EjSQwJe48i4dR8kJkCXlmb7vgyn)
- For D1 database operations, prefer MCP / Cloudflare bindings tools when available.
- Figma MCP is available in this project and should be used when design context, node inspection, or design-to-code work is needed.

## Change Rules

- When changing database schema, table structure, D1 migrations, or persistence fields, also update [docs/d1-database-design.md](D:/project/dream/docs/d1-database-design.md).
- If the schema change affects business meaning, user flow, or rule behavior, also update [docs/project-overview.md](D:/project/dream/docs/project-overview.md).
- Database changes should be checked for consistency across:
  - schema files
  - migration files
  - D1 design documentation
- After database-related changes, prefer running a D1 smoke test with [scripts/test-d1.ts](D:/project/dream/scripts/test-d1.ts) or equivalent MCP verification.

## Skills

This repo includes local skills under [.agents/skills](D:/project/dream/.agents/skills).

Available project skills:

- `browse`
- `investigate`
- `office-hours`
- `plan-ceo-review`
- `plan-eng-review`
- `qa`
- `review`
- `ship`
- `shipany-page-builder`
- `shipany-quick-start`
- `supabase-to-d1`

### Skill Usage Notes

- Use `browse` for browser validation, screenshots, and user-flow testing.
- Use `investigate` for debugging and root-cause analysis before fixing.
- Use `qa` for structured QA passes and bug-fix loops.
- Use `review` for code review and pre-merge risk checking.
- Use `ship` for release, PR, and deployment workflows.
- Use `supabase-to-d1` when working on database migration or provider switching toward D1.

## MCP Preferences

### D1

- D1 database read/write/check operations can use Cloudflare MCP tools directly.
- During development, integration, and verification, treat remote Cloudflare D1 as the default database of record.
- Remote D1 development should use `pnpm wrangler login` with manual OAuth authorization.
- After database-related changes, verify writes/reads against remote D1 with Cloudflare MCP instead of trusting page behavior alone.
- Local SQLite is fallback-only and must not be treated as the default source of truth.
- Prefer MCP for:
  - listing D1 databases
  - checking schema state
  - running smoke-test SQL
  - verifying inserts/selects/deletes
- Use repo scripts when validating app-side integration or local `wrangler` behavior.

### Figma

- Figma MCP is available and should be used for:
  - reading design context
  - inspecting nodes
  - mapping design to implementation
  - pulling screenshots or variables
- Prefer Figma MCP over guessing from static screenshots when node/file access is available.

### Chrome MCP

- When reading the Lark project documentation or validating browser flows, first ensure a local browser instance is started.
- Then use Chrome MCP / Chrome DevTools MCP to open the target page.
- Preferred documentation URL for browser opening:
  - [梦幻核心说明0326](https://csgy1xzrndus.sg.larksuite.com/wiki/EjSQwJe48i4dR8kJkCXlmb7vgyn)

## Current Docs

- D1 database design: [docs/d1-database-design.md](D:/project/dream/docs/d1-database-design.md)
- Project overview: [docs/project-overview.md](D:/project/dream/docs/project-overview.md)
- Cloudflare deploy guide: [docs/cloudflare-d1-deploy.md](D:/project/dream/docs/cloudflare-d1-deploy.md)
