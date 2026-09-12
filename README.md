# ViteSakuga

Cloning a mvp of sakugabooru but with mainly typescript and good libs

- [ ] better style Video (fix tailwind class not working)
- [x] add shortcut keys to navigate to /user /tag /post toggle filters / seek next/previous frame / next/previous post / focus search
  - [media chrome keyboard shortcuts](https://www.media-chrome.org/docs/en/keyboard-shortcuts)
- [x] advanced post search filters (server-side numeric filters for dimensions and likes)
- [x] consolidate post schemas and server functions around Effect services
- [x] passkey / TOTP
- [x] github login
  - [x] google login
    - [ ] add test to this login, make it undependant of each service if possible
- [x] captcha ?
- [ ] better auth sentinel?
- [ ] auto video duplication finder or vvv
  - [ ] video duplication vote or vvv
    - [ ] report video system (low quality, duplicate, ???)
- [x] support manga images share beautiful pannels
- [x] detailed episode informations (when upload, put episode / season info)
- [x] user roles, uploader, verified
- [ ] WASM (or not) browser client side image upscaler
- [ ] accessibility check
- [ ] advance filter (exclude words, post with minimum of likes, width, height)

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
```

Nub loads and validates the environment with Varlock before running scripts or
Node files. The committed `.env.schema` documents the stages and required
variables; keep actual credentials in the ignored stage files (`.env`,
`.env.test`, or `.env.production`).

```bash
# inspect the resolved, redacted environment
nub exec varlock load --format json
```

```
nub run dev
```

The project pins `nitro@3.0.260610-beta` with Vite 8.2.x. The newer
`nitro@3.0.260903-beta` development runner sends React's CommonJS entry
through the local Workerd evaluator without the `module` global, causing
`nub run dev` to fail with `ReferenceError: module is not defined`. The pinned
combination keeps Cloudflare development emulation and the deployable build
working. Do not update Nitro alone until this upstream incompatibility is
fixed.

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
| `build:dev`                                         | dev-site build (production React runtime + dev-stage `.env`, decoupled via `APP_ENV`) | dev                         | `development` / `production` / `.env`             | `development`     |
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

# Deploy the dev resources (bucket, domain, and CORS come from the stage map)
nub run infra:deploy

# Deploy the production resources
nub run infra:deploy:prod
```

### 3. Sync to Environment

Alchemy derives bucket names, custom domains, CORS, and Worker storage bindings
from `src/lib/env/stage-config.ts`; deployable Vite builds use that same map for
their app and media URLs. There is no bucket or URL value to copy between env
files. Update that single stage map when a resource name or domain intentionally
changes, then rebuild and deploy the same stage.

You also need to manually add the **S3 API Token** from the Cloudflare R2 dashboard to your `.env` file to set `CLOUDFLARE_ACCESS_KEY` and `CLOUDFLARE_SECRET_KEY`:

```env
CLOUDFLARE_ACCESS_KEY="your-access-key"
CLOUDFLARE_SECRET_KEY="your-secret-key"
```

## Production CI/CD

La production ne se déploie pas sur chaque commit. La CI vérifie chaque pull
request et chaque push sur `master`; le déploiement démarre seulement après
publication d'une GitHub Release. Le workflow capture la version Cloudflare
active, déploie via Alchemy, vérifie le site et surveille les erreurs Worker.
Au-dessus du seuil configuré, il exécute automatiquement un rollback vers la
version précédente.

Voir [docs/deployment.md](docs/deployment.md) pour configurer l'environnement
GitHub `production`, le token Cloudflare, le secret `.env.production` et le
service token Cloudflare Access nécessaire au smoke check.
