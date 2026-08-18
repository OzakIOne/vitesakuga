# Build Environment: NODE_ENV vs --mode

`NODE_ENV` (Node.js standard) and `--mode` (Vite-specific) control different things and are independent.

## NODE_ENV

Controls **runtime behavior of libraries** in the browser bundle.

| Value | Effect |
|---|---|
| `"production"` | React strips dev warnings, enables optimizations. Libraries (Zustand, React Query, etc.) skip debug checks. Vite defaults to this in `vite build`. |
| `"development"` | React keeps dev warnings + extra checks. Libraries enable debug/dev mode. Vite defaults to this in `vite dev`. |

Vite replaces `process.env.NODE_ENV` with a string literal at build time via `define`. This enables **runtime branch elimination**: `if (process.env.NODE_ENV !== "production")` is stripped entirely from production builds.

## --mode

Controls **build-time behavior of Vite itself**.

| What it affects | How |
|---|---|
| **Env file selection** | Vite loads `.env.[mode]` (e.g. `--mode development` → `.env.development`) |
| **`import.meta.env.MODE`** | Baked string literal available in code — `import.meta.env.DEV` / `import.meta.env.PROD` derived from it |
| **Conditional code blocks** | `if (import.meta.env.MODE !== "production")` — strip or keep based on mode |

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

In `package.json`:

```json
"build":     "NODE_ENV=production vite build --mode production",
"build:dev": "NODE_ENV=development vite build --mode development",
```

- `--mode` selects the right `.env` file and bakes the right `MODE` / `import.meta.env.*` values.
- `NODE_ENV` ensures `process.env.NODE_ENV` is correct in the bundle (controls React runtime mode).
- `NODE_ENV` also affects **nub**: nub loads `.env.$NODE_ENV` into `process.env` before Vite runs. Vite gives existing `process.env` vars the highest priority over `.env` files. So `NODE_ENV=` in the script is what makes nub load the correct stage's env file.

### Tradeoff

`NODE_ENV=development` in `build:dev` makes the dev bundle run React in dev mode (extra warnings, slightly slower). This is acceptable for a dev site. To keep a production-optimized React bundle on the dev site while still loading the correct env file, a build script that strips ambient `VITE_*` vars and loads the stage file explicitly is needed (see `scripts/build-stage.mjs` history or git log).
