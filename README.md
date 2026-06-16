# ViteSakuga

Cloning a mvp of sakugabooru but with mainly typescript and good libs

- [ ] fix createHandler typing issue
- [ ] add playlist feature, which are pools in sakugabooru i think anyway, playlist like on youtube
- [ ] dockploy ??
- [ ] split upload and convert into components and utils
- [ ] better style Video (fix tailwind class not working)
- [x] add shortcut keys to navigate to /user /tag /post toggle filters / seek next/previous frame / next/previous post / focus search
  - there is builtint keyboard shortcut in media chrome
- [ ] filterAndSortPosts check how it worked before and how it works now, should we filter client or server side?
- [ ] cleanup post schemas and server fn
- [ ] prevent the sidebar from blinking of rerender / Suspense somehow
- [ ] ask neo how to better handle currentUserId /src/routes/posts/$postId.tsx `const currentUserId = context.user?.id;`
- [ ] better handle optional props that shouldnt be optional is some cases, currentUserId in comments.tsx maybe not sure
- [ ] better ui

## Patches

- **`@tanstack/react-db` SSR crash (React 19):** `pnpm` patch adds `getServerSnapshot` to `useSyncExternalStore` to fix `Missing getServerSnapshot` error during SSR.
  - Upstream PR: https://github.com/TanStack/db/pull/1534
  - Tracking issue: https://github.com/TanStack/db/issues/545
  - When the PR is merged and released, remove:
    - `pnpm.patchedDependencies["@tanstack/react-db"]` from `package.json`
    - `patches/@tanstack__react-db.patch`

## Secondary

- [ ] ? add post ranking

## Dev

```bash
git clone https://github.com/ozaki/vitesakuga
cd vitesakuga
pnpm i
pnpm dev
```

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
npx alchemy login

# Set your Cloudflare Account ID
export CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID"

# Deploy the resources
pnpm run infra:deploy
```

### 3. Sync to Environment

Follow the console output from the deploy script to manually update your `.env` file with the newly created bucket name and your account ID.

You also need to manually add the **S3 API Token** from the Cloudflare R2 dashboard to your `.env` file to set `CLOUDFLARE_ACCESS_KEY` and `CLOUDFLARE_SECRET_KEY`:

```env
CLOUDFLARE_ACCESS_KEY="your-access-key"
CLOUDFLARE_SECRET_KEY="your-secret-key"
```
