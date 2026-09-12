# Testing

## Commands

Use `nub` for all project commands:

```sh
nub exec vitest run                 # all unit/integration tests
nub exec vitest run path/to/test.ts # one test file
nub run test:deployment             # deployment monitor/rollback decisions
nub run test                        # Vitest watch mode
nub run test:ee                     # Playwright e2e suite
```

Vitest is configured with a maximum of four workers in `vitest.config.ts`. The
service-test harness uses real PGlite and RustFS layers where practical. E2e
runs use the Playwright web server on port 3100 with local Postgres and RustFS;
they are separate from the Vitest suite. The local server uses Nitro's
`node-server` preset and disables the Turnstile requirement so the browser tests
exercise the same authentication path as the test server.

## Current verification

On **2026-09-12**, `nub exec vitest run --maxWorkers=1` passed **693 tests in 75 test files**.
The full Playwright suite passed **58/58 tests in 15 files** (`nub run test:ee`).
These are point-in-time results; rerun the commands after code or dependency
changes.

The deployment monitor and rollback command construction are covered by the
focused `test:deployment` check. Its pure decision helpers run without
Cloudflare or Wrangler credentials.

The e2e specs currently cover authentication, comments, conversion, account
deletion, hydration, mentions, passkeys, playlists, shortcuts, toasts, 2FA,
uploads, and votes. Use `nub exec playwright test --config=e2e/playwright.config.ts --list`
to inspect the current discovered test list without running it.

## Test conventions

- Prefer real PGlite/RustFS behavior over mocks for service and storage tests.
- Assert tagged Effect failures using `_tag` and relevant fields.
- Keep test fixtures deterministic and close database/storage resources in
  cleanup hooks.
- Keep e2e setup failures visible; do not convert an unavailable local service
  into a passing or silently skipped test.
