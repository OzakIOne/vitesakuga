# ViteSakuga

Cloning a mvp of sakugabooru but with mainly typescript and good libs

- [ ] fix createHandler typing issue
- [ ] split upload and convert into components and utils
- [ ] better style Video (fix tailwind class not working)
- [x] add shortcut keys to navigate to /user /tag /post toggle filters / seek next/previous frame / next/previous post / focus search
  - [media chrome keyboard shortcuts](https://www.media-chrome.org/docs/en/keyboard-shortcuts)
- [ ] filterAndSortPosts check how it worked before and how it works now, should we filter client or server side?
- [ ] cleanup post schemas and server fn
- [ ] better handle optional props that shouldnt be optional is some cases, currentUserId in comments.tsx or /posts/$postId.tsx maybe not sure

## Secondary

- [ ] ? add post ranking

## Dev

```bash
git clone https://github.com/ozakione/vitesakuga
cd vitesakuga
nub install
cp .env.example .env
# setup infra buckets api tokens etc
nub run infra:deploy
nub run dev
```

## Environments

Three stages, each with its own gitignored env file:

| Stage | Env file          | DB / storage             | Command             |
| ----- | ----------------- | ------------------------ | ------------------- |
| local | `.env.test`       | Docker Postgres + rustfs | `nub run dev:local` |
| dev   | `.env`            | Neon dev branch + R2 dev | `nub run dev`       |
| prod  | `.env.production` | Neon prod + R2 prod      | `nub run dev:prod`  |

The DB CLI is stage-aware: `STAGE=prod nub run db migrate` loads
`.env.production` (shortcuts: `nub run db:local <command>`, `nub run db:dev <command>`, `nub run db:prod <command>`).

## Commands

Every stage-specific script follows `verb:stage`. The unsuffixed script is the
shortcut for its most common stage. Three independent axes are pinned per
script: app stage, `APP_ENV` (which env file _nub_ loads), `NODE_ENV` (the
React/bundle runtime), and Vite `--mode` (bakes `import.meta.env.MODE`).

| Script                                              | Runs                                                                                  | Stage                       | `APP_ENV` / `NODE_ENV` / env file                 | Vite `--mode`     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------- | ----------------- |
| `dev`                                               | dev server                                                                            | dev                         | `development` / `development` / `.env`            | `development`     |
| `dev:local`                                         | dev server (Docker Postgres + rustfs)                                                 | local                       | `test` / `test` / `.env.test`                     | `test`            |
| `dev:prod`                                          | dev server against prod infra                                                         | prod                        | `production` / `production` / `.env.production`   | `production`      |
| `build`                                             | production build                                                                      | prod                        | `production` / `production` / `.env.production`   | `production`      |
| `build:dev` (alias `build:staging`)                 | dev-site build (production React runtime + dev-stage `.env`, decoupled via `APP_ENV`) | dev                         | `development` / `production` / `.env`             | `development`     |
| `start`                                             | run built Node server                                                                 | prod                        | —                                                 | —                 |
| `server`                                            | preview built Worker (wrangler, generates `.dev.vars` from `.env`)                    | dev                         | `production`                                      | —                 |
| `wrangler:dev` / `wrangler:preview`                 | dev / preview through Wrangler Pages                                                  | dev                         | `development` / `.env`                            | `development` / — |
| `db` / `db:dev` / `db:local` / `db:prod`            | drizzle-kit CLI (stage via `STAGE=`)                                                  | dev / local / prod          | `.env` / `.env` / `.env.test` / `.env.production` | —                 |
| `infra:dev`                                         | Alchemy dev                                                                           | dev (alchemy `dev`)         | `.env`                                            | —                 |
| `infra:deploy`                                      | builds (dev) → guard → Alchemy deploy                                                 | dev (alchemy `dev`)         | `.env`                                            | —                 |
| `infra:deploy:prod`                                 | builds (prod) → guard → Alchemy deploy                                                | prod (alchemy `production`) | `.env.production`                                 | —                 |
| `infra:destroy` / `infra:destroy:prod`              | Alchemy destroy                                                                       | dev / prod                  | `.env` / `.env.production`                        | —                 |
| `docker:up` / `docker:down` (aliases `dcu` / `dcd`) | local Docker stack (Postgres, rustfs, lightpanda, otelite)                            | local                       | `.env.test`                                       | —                 |

> Note: app stages are `local` / `dev` / `prod`, but Alchemy stages are `dev` /
> `production` — the Alchemy stack derives bucket names
> (`vitesakuga-media-production`), domains, and CORS from those exact strings,
> so the infra scripts keep them. See `docs/build-environment.md` for why
> `APP_ENV`, `NODE_ENV`, and `--mode` are set the way they are.

## Infrastructure Setup

This project uses **Alchemy** to automate the creation of Cloudflare R2 buckets.

### 1. Prerequisites

- A [Cloudflare Account](https://dash.cloudflare.com/)
- [Node.js](https://nodejs.org/) installed
- Cloudflare **Account ID** (found on your dashboard)
- Cloudflare **API Token** with `R2 Edit` permissions

### 2. Deploy the Bucket

Set your Account ID and deploy from the project root:

```bash
# Authenticate with Cloudflare
nub exec alchemy login

# Set your Cloudflare Account ID
export CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID"

# Deploy the resources (dev stage keeps the existing vitesakuga-media bucket)
nub run infra:deploy

# Deploy the production bucket (creates vitesakuga-media-production)
nub run infra:deploy:prod
```

### 3. Sync to Environment

Follow the console output from the deploy script to manually update the matching env file (`.env` for dev, `.env.production` for prod) with the newly created bucket name and your account ID.

You also need to manually add the **S3 API Token** from the Cloudflare R2 dashboard to your `.env` file to set `CLOUDFLARE_ACCESS_KEY` and `CLOUDFLARE_SECRET_KEY`:

```env
CLOUDFLARE_ACCESS_KEY="your-access-key"
CLOUDFLARE_SECRET_KEY="your-secret-key"
```
