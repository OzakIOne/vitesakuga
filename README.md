# ViteSakuga

Cloning a mvp of sakugabooru but with mainly typescript and good libs

- [ ] dockploy ??
- [ ] split upload and convert into components and utils
- [ ] better style Video (fix tailwind class not working)
- [ ] add shortcut keys to navigate to /user /tag /post toggle filters / seek next/previous frame / next/previous post / focus search
  - there is builtint keyboard shortcut in media chrome
- [ ] filterAndSortPosts check how it worked before and how it works now, should we filter client or server side?
- [x] add dompurify with z.transform to schemas
- [ ] cleanup post schemas and server fn
- [ ] prevent the sidebar from blinking of rerender / Suspense somehow
- [ ] ask neo how to better handle currentUserId /src/routes/posts/$postId.tsx `const currentUserId = context.user?.id;`
- [ ] better handle optional props that shouldnt be optional is some cases, currentUserId in comments.tsx maybe not sure
- [ ] better ui
- [x] convert.tsx [mediabunny](https://mediabunny.dev) instead of old lib
- [x] try pulumi to setup project bucket and domain name from scratch with typescript
- [x] Store list scroll position and loaded data state in the URL, so when a user shares the URL, it restores the exact position in the infinite list (like pagination)
- [x] in the searchbox add the feature that is in the taginput component with tag suggestion to allow for easier tag search
- [x] add <Suspense> for suspenseQueries
- [x] fix upload failing if user doesnt generate a thumbnail
- [x] virtualize posts of other pages than /posts so /user/id /tags/tag and make component of rendered list to avoid code duplication
- [x] fix virtualize .window error
- [x] maybe change search behavior, if we are in user route then search should search for users and not go back to default posts route?
- [x] add some toasts to forms / mutations for success / errors
- [x] make a card component for displaying a single post in a list
- [x] avoid code duplication in the filter thing
- [x] add cursor/pagination thing to /user /tag
- [x] move everything to query instead of router loader
- [x] fix build and start errors
- [x] fix vite serve
- [x] transfer data from loaders to query
- [x] better .env handling (crash if not defined and use zod to validate)
- [x] fix build with rolldown
- [x] check cursor db implementation
- [x] manage account page
- [x] add comments to posts
- [x] modify posts
- [x] add preview image to post
- [x] scroll restoration from post to back to posts list (only works in prod build not dev)

## Secondary

- [ ] ? add post ranking
- [x] add search filters
- [x] mediainfo
- [x] use kyselyfy from drizzle to cleanup database types
- [x] add tags to posts

## Dev

```bash
git clone https://github.com/ozaki/vitesakuga
cd vitesakuga
pnpm i
pnpm dev
```

## Infrastructure Setup

This project uses **Pulumi** to automate the creation of Cloudflare R2 buckets.

### 1. Prerequisites

- A [Cloudflare Account](https://dash.cloudflare.com/)
- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed
- Cloudflare **Account ID** (found on your dashboard)
- Cloudflare **API Token** with `R2 Edit` permissions

### 2. Deployment

Navigate to the `infra` directory and configure your credentials:

```bash
cd infra

# Set your Cloudflare details
pulumi config set cloudflare:accountId YOUR_ACCOUNT_ID
pulumi config set cloudflare:apiToken YOUR_API_TOKEN --secret

# Deploy the resources
pulumi up
```

### 3. Sync to Environment

After a successful deployment, run the sync script in the root directory to update your `.env` file:

```bash
./sync-infra.sh
```

> **Note:** You will still need to manually generate an **S3 API Token** from the Cloudflare R2 dashboard to get the `CLOUDFLARE_ACCESS_KEY` and `CLOUDFLARE_SECRET_KEY` required in your `.env`.
