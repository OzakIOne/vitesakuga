---
name: playlist-e2e
description: Reproduces and verifies ViteSakuga playlist membership flows with the isolated Playwright E2E suite. Use when changing or investigating the post-detail “Add to playlist” action, playlist membership, or playlist E2E setup.
---

# Playlist E2E

## Run the focused regression

```sh
APP_ENV=test NODE_ENV=test \
BETTER_AUTH_SECRET=workspace-e2e-placeholder-secret-not-for-production \
DATABASE_URL="postgresql://user:password@localhost:15432/sakuga?sslmode=disable" \
CLOUDFLARE_BUCKET=e2e-test \
CLOUDFLARE_R2=http://localhost:9000 \
CLOUDFLARE_ACCESS_KEY=rustfsadmin \
CLOUDFLARE_SECRET_KEY=rustfsadmin \
VITE_BASE_URL=http://localhost:3100 \
VITE_CLOUDFLARE_R2_PUBLIC_URL=http://localhost:9000/e2e-test \
nub exec playwright test --config=e2e/playwright.config.ts e2e/playlists.spec.ts --grep "detail page"
```

The Playwright config starts the test app on port 3100. Its setup uses the isolated `postgres-e2e` service on port 15432 and RustFS on port 9000. It reuses a responding RustFS instead of starting a conflicting container. Ensure `nub` and Docker Compose are available on `PATH`. The command supplies test-only placeholders because fresh JJ workspaces lack the ignored `.env.test`; do not replace them with real credentials.

## Extend the coverage

- Add playlist regressions to `e2e/playlists.spec.ts`; reuse its generated posts, playlist, and `e2e-test-auth=bypass` session.
- Use generated IDs and the test fixture instead of hard-coded account credentials, post IDs, or playlist IDs.
- Click the custom playlist checkbox’s visible label, not its hidden input; assert the checked state and the post on the playlist page. Do not log cookies or auth response bodies.
- Use the `browser-control` skill only for the user’s visible browser; it is not the deterministic E2E runner.
- See [Testing](../../../docs/testing.md) for the project’s commands and test conventions.
