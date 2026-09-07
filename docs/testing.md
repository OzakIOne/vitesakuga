# Testing

## Commands

Use `nub` for all project commands:

```sh
nub exec vitest run                 # all unit/integration tests
nub exec vitest run path/to/test.ts # one test file
nub run test                        # Vitest watch mode
nub run test:ee                     # Playwright e2e suite
```

Vitest is configured with a maximum of four workers in `vitest.config.ts`. The
service-test harness uses real PGlite and RustFS layers where practical. E2e
runs use the Playwright web server on port 3100 with local Postgres and RustFS;
they are separate from the Vitest suite.

## Current verification

On **2026-09-06**, `nub exec vitest run --reporter=json` passed **566 tests in
53 test files**. This is a point-in-time result; rerun the command after code or
dependency changes.

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
