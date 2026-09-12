# Build Environment: NODE_ENV vs --mode

`NODE_ENV` (Node.js standard) and `--mode` (Vite-specific) control different things and are independent.

## NODE_ENV

Controls **runtime behavior of libraries** in the browser bundle.

| Value           | Effect                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"production"`  | React strips dev warnings, enables optimizations. Libraries (Zustand, React Query, etc.) skip debug checks. Vite defaults to this in `vite build`. |
| `"development"` | React keeps dev warnings + extra checks. Libraries enable debug/dev mode. Vite defaults to this in `vite dev`.                                     |

Vite replaces `process.env.NODE_ENV` with a string literal at build time via `define`. This enables **runtime branch elimination**: `if (process.env.NODE_ENV !== "production")` is stripped entirely from production builds.

## --mode

Controls **build-time behavior of Vite itself**.

| What it affects             | How                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Env file selection**      | Vite loads `.env.[mode]` (e.g. `--mode development` → `.env.development`)                               |
| **`import.meta.env.MODE`**  | Baked string literal available in code — `import.meta.env.DEV` / `import.meta.env.PROD` derived from it |
| **Conditional code blocks** | `if (import.meta.env.MODE !== "production")` — strip or keep based on mode                              |

In this repository, `APP_ENV` is the stage selector used by Nub and Nitro before Vite runs. It maps `development`/`dev` to `.env`, `test`/`local` to `.env.test`, and `production`/`prod` to `.env.production`. `--mode` still controls Vite's own mode and `import.meta.env.MODE`; it is not a replacement for `APP_ENV`.

It does **not** change `NODE_ENV`. They are independent.

## Relationship

```
vite build --mode development
│                                    │
│  --mode → loads .env.development   │  MODE = "development" in bundle
│           import.meta.env.MODE     │  import.meta.env.DEV = true
│                                    │
│  NODE_ENV?                         │
│  ├─ already in process.env → kept  │
│  └─ unset → defaults to "production│
```

### Implications for our build scripts

Nub loads `.env` files itself (`.env`, `.env.[mode]`, `.env.local`, …) before the
script runs, using an `[mode]` slot selected by `APP_ENV` (falling back to a
clamped `NODE_ENV`). That makes `APP_ENV` the **stage selector** (which env
file loads), fully decoupled from `NODE_ENV` (the React runtime). Each script
pins both explicitly:

```json
"build":     "APP_ENV=production  NODE_ENV=production  vite build --mode production",
"build:dev": "APP_ENV=development NODE_ENV=production  vite build --mode development",
```

- `APP_ENV` tells nub which stage's env file to read: `development` → `.env`
  (dev vars), `test` → `.env.test`, `production` → `.env.production`.
- `NODE_ENV=production` is pinned on every deployable build line, so React's
  production runtime is always used — even if `.env` sneaks in
  `NODE_ENV=development` (a script-line value wins over a `.env` value).
- `--mode` selects Vite's own `.env` loading / `import.meta.env.MODE` and is
  aligned with `APP_ENV` per stage.

So `build:dev` no longer needs a wrapper script — the two variables are
decoupled, and "production React runtime + dev stage's client env" is expressed
directly on the script line. The supported script name is `build:dev`; the
stage is called `dev`, not `staging`.

### Footgun: never set `NODE_ENV=development` for a deployable build

`NODE_ENV=development vite build --mode development` compiles the SSR chunks
against React's **dev JSX runtime** (`react/jsx-dev-runtime` → `jsxDEV` calls),
while the bundled React libs are the **production** builds, where
`exports.jsxDEV = void 0`. Every page then throws
`TypeError: (0 , import_jsx_dev_runtime.jsxDEV) is not a function`, which
TanStack Start serializes as the generic
`{"status":500,"unhandled":true,"message":"HTTPError"}` payload.

The pre-deploy guard `scripts/check-prod-build.mjs` scans the built SSR chunks
for dev-JSX-runtime usage. `infra:deploy` / `infra:deploy:prod` build the
correct stage first (`build:dev` / `build`) and then run the guard, so an
out-of-date or poisoned bundle can't reach Cloudflare; the guard remains as
belt-and-braces for direct `alchemy deploy` invocations.

The e2e bypass is separately gated by `DATABASE_DRIVER=e2e` and non-production
`NODE_ENV`; it is configured only by `e2e/playwright.config.ts`, not by a
client-facing `VITE_E2E_MODE` flag.

## Cloudflare dev runner compatibility

The project intentionally pins `nitro@3.0.260610-beta` with Vite 8.2.x. The
newer `nitro@3.0.260903-beta` development runner sends React's CommonJS entry
through the Workerd module evaluator without `module`, which makes
`nub run dev` fail with `ReferenceError: module is not defined`. The pinned
combination keeps Cloudflare development emulation and passes both the dev
server smoke check and the deployable build. Do not update Nitro alone until
that upstream incompatibility is fixed.
